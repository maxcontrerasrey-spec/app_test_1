import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Requerimientos: node >= 18 (fetch incluido)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const GNEWS_BASE_URL = process.env.GNEWS_BASE_URL || 'https://gnews.io/api/v4/search';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan credenciales de Supabase (VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

if (!GNEWS_API_KEY) {
  console.error("Falta la credencial de GNews (GNEWS_API_KEY).");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const QUERIES = [
  { key: 'mineria', query: 'Minería Chile' },
  { key: 'economia', query: 'Economía Chile' }
];

function generateHash(title, sourceName) {
  return crypto.createHash('sha256').update(`${title}-${sourceName}`).digest('hex');
}

async function fetchAndSync() {
  console.log(`[${new Date().toISOString()}] Iniciando sincronización de GNews...`);
  let hasErrors = false;

  for (const item of QUERIES) {
    try {
      console.log(`Buscando noticias para: ${item.query} (${item.key})`);
      
      const url = new URL(GNEWS_BASE_URL);
      url.searchParams.append('q', item.query);
      url.searchParams.append('lang', 'es');
      url.searchParams.append('country', 'cl');
      url.searchParams.append('max', '10'); // Max articles per category
      url.searchParams.append('apikey', GNEWS_API_KEY);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`GNews API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const articles = data.articles || [];

      console.log(`Se encontraron ${articles.length} artículos para ${item.key}.`);

      if (articles.length === 0) continue;

      const formattedArticles = articles.map(article => {
        return {
          categoria: item.key,
          titulo: article.title,
          resumen: article.description,
          fuente: article.source.name,
          url: article.url,
          imagen_url: article.image,
          fecha_publicacion: article.publishedAt,
          fecha_actualizacion: new Date().toISOString(),
          hash_unico: generateHash(article.title, article.source.name)
        };
      });

      // Upsert into Supabase
      const { error } = await supabase
        .from('global_news')
        .upsert(formattedArticles, { onConflict: 'hash_unico' });

      if (error) {
        throw error;
      }

      console.log(`Upsert exitoso para ${item.key}. Procediendo con la limpieza (mantener 20).`);

      // Cleanup: keep only latest 20 for this category
      const { data: keepData, error: keepError } = await supabase
        .from('global_news')
        .select('id')
        .eq('categoria', item.key)
        .order('fecha_publicacion', { ascending: false })
        .limit(20);

      if (keepError) {
        throw keepError;
      }

      if (keepData && keepData.length === 20) {
        // Only attempt cleanup if we actually have 20 rows (meaning there could be extras)
        const keepIds = keepData.map(d => d.id);
        // Use a sub-select approach: delete rows older than the 20th newest
        const { data: allRows } = await supabase
          .from('global_news')
          .select('id')
          .eq('categoria', item.key);

        if (allRows && allRows.length > 20) {
          const idsToDelete = allRows
            .filter(row => !keepIds.includes(row.id))
            .map(row => row.id);

          if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
              .from('global_news')
              .delete()
              .in('id', idsToDelete);
              
            if (deleteError) {
              console.error(`Error al limpiar antiguas noticias de ${item.key}:`, deleteError.message);
            } else {
              console.log(`Limpieza: ${idsToDelete.length} noticias antiguas eliminadas de ${item.key}.`);
            }
          }
        }
      }

    } catch (err) {
      console.error(`Error procesando categoría ${item.key}:`, err);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.warn(`[${new Date().toISOString()}] Sincronización completada con errores parciales.`);
    // Exit code 0 so github actions doesn't completely fail if one category fails, but we logged the error.
  } else {
    console.log(`[${new Date().toISOString()}] Sincronización completada exitosamente.`);
  }
}

fetchAndSync().catch(err => {
  console.error("Error crítico no controlado:", err);
  process.exit(1);
});
