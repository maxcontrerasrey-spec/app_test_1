import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";
import { pipeline } from "@xenova/transformers";

const supabaseUrl = "https://pzblmbahnoyntrhistea.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const supabase = createClient(supabaseUrl, supabaseKey);

function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

async function run() {
  console.log("Loading embedding model...");
  const extractor = await pipeline('feature-extraction', 'Supabase/gte-small');
  
  console.log("Fetching files from storage...");
  const { data: files } = await supabase.storage.from("orion_knowledge").list();
  
  for (const file of files || []) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    
    console.log(`\nProcessing: ${file.name}`);
    const { data: fileData, error: dlError } = await supabase.storage.from("orion_knowledge").download(file.name);
    if (dlError) {
      console.error("Error downloading:", dlError);
      continue;
    }

    const arrayBuffer = await fileData.arrayBuffer();
    let text = "";

    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const uint8Array = new Uint8Array(arrayBuffer);
        const pdfProxy = await getDocumentProxy(uint8Array);
        const extracted = await extractText(pdfProxy, { mergePages: true });
        text = extracted.text;
      } else {
        text = new TextDecoder().decode(arrayBuffer);
      }
    } catch (e) {
      console.error("Error parsing document:", e.message);
      continue;
    }
    
    const cleanText = text.replace(/\s+/g, " ").trim();
    if (!cleanText) {
      console.log(`No text found in ${file.name}`);
      continue;
    }
    
    // Clear existing chunks for this file
    await supabase.from("orion_knowledge_base").delete().eq("document_name", file.name);
    
    const chunks = chunkText(cleanText, 1000, 200);
    console.log(`Generated ${chunks.length} chunks. Generating embeddings...`);
    
    let insertedCount = 0;
    for (const chunk of chunks) {
      const output = await extractor(chunk, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      
      const { error } = await supabase.from("orion_knowledge_base").insert({
        document_name: file.name,
        content: chunk,
        embedding: embedding
      });
      
      if (error) console.error("Insert error:", error.message);
      else insertedCount++;
    }
    console.log(`Finished ${file.name}. Inserted ${insertedCount} chunks.`);
  }
}

run().catch(console.error);
