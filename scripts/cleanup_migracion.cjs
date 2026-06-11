const { createClient } = require('@supabase/supabase-js');

const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const adminSupabase = createClient("https://pzblmbahnoyntrhistea.supabase.co", supabaseServiceKey);

async function run() {
  console.log("Iniciando borrado de folios fantasmas de 1970...");
  
  // Borramos primero las aprobaciones ligadas a esos folios (por FK constraint)
  // Pero wait, si buscamos hiring_requests con created_at de 1970
  const { data: ghosts, error: fetchError } = await adminSupabase
    .from('hiring_requests')
    .select('id, folio')
    .lt('created_at', '1971-01-01');

  if (fetchError) {
    console.error("Error buscando fantasmas:", fetchError);
    return;
  }

  console.log(`Encontrados ${ghosts.length} folios fantasmas.`);

  if (ghosts.length === 0) return;

  const ghostIds = ghosts.map(g => g.id);

  // 1. Delete audit logs
  await adminSupabase.from('hiring_request_audit_log').delete().in('hiring_request_id', ghostIds);
  // 2. Delete approvals
  await adminSupabase.from('hiring_request_approvals').delete().in('hiring_request_id', ghostIds);
  // 3. Delete recruitment cases (if any)
  await adminSupabase.from('recruitment_cases').delete().in('hiring_request_id', ghostIds);
  // 4. Delete the hiring requests
  const { error: delError } = await adminSupabase.from('hiring_requests').delete().in('id', ghostIds);

  if (delError) {
    console.error("Error borrando hiring_requests:", delError);
  } else {
    console.log("¡Borrado quirúrgico completado exitosamente!");
  }
}

run();
