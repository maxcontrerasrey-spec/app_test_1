import React, { useEffect, useState } from "react";
import { supabase } from "../../../shared/lib/supabase";

type NewsItem = {
  titulo: string;
  resumen: string;
  fuente: string;
  url: string;
  imagen_url: string;
  fecha_publicacion: string;
};

type NewsData = {
  mineria: NewsItem[];
  economia: NewsItem[];
  ultima_actualizacion: string | null;
};

export function DashboardNewsWidget() {
  const [data, setData] = useState<NewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data: response, error } = await supabase.rpc('get_home_news');
        if (error) throw error;
        
        setData(response as NewsData);
      } catch (err) {
        console.error("Error cargando noticias:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadNews();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="dashboard-news-widget" aria-label="Noticias globales">
        <article className="dashboard-news-capsule is-loading">
          <strong>Cargando...</strong>
        </article>
        <article className="dashboard-news-capsule is-loading">
          <strong>Cargando...</strong>
        </article>
      </div>
    );
  }

  const renderCapsule = (categoryLabel: string, items: NewsItem[]) => {
    if (items.length === 0) {
      return (
        <article className="dashboard-news-capsule">
          <div className="dashboard-news-empty">No hay noticias de {categoryLabel}</div>
        </article>
      );
    }
    
    // Solo mostramos 1 noticia por cápsula (la más reciente)
    const item = items[0];
    const categoryPrefix = categoryLabel.charAt(0);

    return (
      <a 
        href={item.url} 
        target="_blank" 
        rel="noreferrer" 
        className="dashboard-news-capsule"
      >
        {item.imagen_url ? (
          <img 
            src={item.imagen_url} 
            alt={item.fuente} 
            className="dashboard-news-capsule-thumb" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('is-hidden');
            }} 
          />
        ) : null}
        <div className={`dashboard-news-capsule-fallback ${item.imagen_url ? 'is-hidden' : ''}`}>
          {categoryPrefix}
        </div>
        <div className="dashboard-news-capsule-content">
          <div className="dashboard-news-capsule-meta">
            {categoryLabel} · {item.fuente}
          </div>
          <h4 className="dashboard-news-capsule-title" title={item.titulo}>{item.titulo}</h4>
          <p className="dashboard-news-capsule-summary">{item.resumen}</p>
        </div>
      </a>
    );
  };

  return (
    <div className="dashboard-news-widget" aria-label="Noticias globales">
      {renderCapsule("Economía", data.economia)}
      {renderCapsule("Minería", data.mineria)}
    </div>
  );
}
