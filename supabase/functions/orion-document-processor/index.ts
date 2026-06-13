import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf";

type EmbeddingRunOptions = {
  mean_pool: boolean;
  normalize: boolean;
};

type SupabaseAiSession = {
  run(input: string, options: EmbeddingRunOptions): Promise<ArrayLike<number>>;
};

type SupabaseAiRuntime = {
  ai: {
    Session: new (model: string) => SupabaseAiSession;
  };
};

function getSupabaseAiRuntime() {
  return Supabase as unknown as SupabaseAiRuntime;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function chunkText(text: string, chunkSize = 1000, overlap = 200) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
      }
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Supabase no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Use service role to bypass RLS for fetching the file and inserting into knowledge base
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { filePath } = await req.json();

    if (!filePath) {
      return new Response(JSON.stringify({ error: "filePath es requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`Procesando documento: ${filePath}`);

    // 1. Descargar archivo
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("orion_knowledge")
      .download(filePath);

    if (downloadError || !fileData) {
      throw new Error(`Error descargando el archivo: ${downloadError?.message}`);
    }

    const arrayBuffer = await fileData.arrayBuffer();
    
    // 2. Extraer texto del PDF
    let extractedText = "";
    if (filePath.toLowerCase().endsWith(".pdf")) {
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfProxy = await getDocumentProxy(uint8Array);
      const { text } = await extractText(pdfProxy, { mergePages: true });
      extractedText = text;
    } else {
      // Basic text extraction for non-PDF (assuming raw text for now if it's not a PDF)
      // Note: docx parsing in edge runtime requires a different library like mammoth, we skip for now 
      // or assume simple text.
      const decoder = new TextDecoder();
      extractedText = decoder.decode(arrayBuffer);
    }

    const cleanText = extractedText.replace(/\s+/g, " ").trim();

    if (!cleanText) {
      throw new Error("No se pudo extraer texto del documento");
    }

    console.log(`Texto extraído, longitud: ${cleanText.length} caracteres`);

    // 3. Cortar en fragmentos (Chunks)
    const chunks = chunkText(cleanText, 1000, 200);
    console.log(`Se generaron ${chunks.length} fragmentos`);

    // 4. Generar Vectores (Embeddings) e insertar
    const aiSession = new (getSupabaseAiRuntime().ai.Session)("gte-small");

    let insertedCount = 0;
    for (const chunk of chunks) {
      const embeddingArray = await aiSession.run(chunk, { mean_pool: true, normalize: true });
      const embedding = Array.from(embeddingArray);

      const { error: insertError } = await supabase
        .from("orion_knowledge_base")
        .insert({
          document_name: filePath,
          content: chunk,
          embedding: embedding
        });

      if (insertError) {
        console.error("Error insertando chunk:", insertError);
      } else {
        insertedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Procesamiento exitoso. ${insertedCount} fragmentos vectorizados.`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  } catch (err: unknown) {
    console.error("Error procesando documento:", err);
    return new Response(
      JSON.stringify({ error: toErrorMessage(err) }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      }
    );
  }
});
