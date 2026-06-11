const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://pzblmbahnoyntrhistea.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('orion_knowledge_base')
    .select('id, document_name, content')
    .ilike('content', '%velocidad%');
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Matched rows:", data.length);
    data.forEach(d => console.log(`Doc: ${d.document_name}, Content length: ${d.content.length}`));
    if (data.length > 0) {
      console.log("Sample content:", data[0].content.substring(0, 300));
    }
  }

  const { count } = await supabase
    .from('orion_knowledge_base')
    .select('*', { count: 'exact', head: true });
  console.log("Total chunks in DB:", count);
}
run();
