const { createClient } = require("@supabase/supabase-js");
const pdf = require("pdf-parse");

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
  const { pipeline } = await import('@xenova/transformers');
  
  // Initialize embedder
  console.log("Loading model...");
  const extractor = await pipeline('feature-extraction', 'Supabase/gte-small');
  
  console.log("Fetching files from storage...");
  const { data: files } = await supabase.storage.from("orion_knowledge").list();
  
  for (const file of files || []) {
    if (file.name === ".emptyFolderPlaceholder") continue;
    
    console.log(`Processing: ${file.name}`);
    const { data: fileData } = await supabase.storage.from("orion_knowledge").download(file.name);
    const arrayBuffer = await fileData.arrayBuffer();
    
    let text = "";
    if (file.name.toLowerCase().endsWith(".pdf")) {
      let pdfFunc = pdf;
      if (typeof pdf !== "function" && pdf && typeof pdf.default === "function") pdfFunc = pdf.default;
      const data = await pdfFunc(Buffer.from(arrayBuffer));
      text = data.text;
    } else {
      text = new TextDecoder().decode(arrayBuffer);
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
