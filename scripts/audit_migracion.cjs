const { createClient } = require('@supabase/supabase-js');

const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const adminSupabase = createClient("https://pzblmbahnoyntrhistea.supabase.co", supabaseServiceKey);

async function run() {
  const { data: hr, error: hrError } = await adminSupabase
    .from('hiring_requests')
    .select('*')
    .eq('folio', '1443');

  console.log("Hiring Request 1443:", JSON.stringify(hr, null, 2));
  
  if (hr && hr.length > 0) {
    const { data: rc, error: rcError } = await adminSupabase
      .from('recruitment_cases')
      .select('*')
      .eq('hiring_request_id', hr[0].id);
      
    console.log("Recruitment Case for 1443:", JSON.stringify(rc, null, 2));
  }
}

run();
