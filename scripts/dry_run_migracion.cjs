const xlsx = require('@mylinkpi/xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const adminSupabase = createClient("https://pzblmbahnoyntrhistea.supabase.co", supabaseServiceKey);

async function run() {
  const workbook = xlsx.readFile('migracion_folios.xlsx', { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\nIniciando DRY RUN para ${data.length} folios...\n`);
  let errors = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // 1. Check requester email
    const { data: profile } = await adminSupabase.from('profiles').select('id, full_name, job_title').eq('email', row.requester_email.trim()).single();
    if (!profile) {
      console.log(`Fila ${i+2}: ERROR - No se encontró el correo ${row.requester_email} en la BD.`);
      errors++;
      continue;
    }

    // 2. Check job position
    const { data: job } = await adminSupabase.from('job_positions').select('id, name').ilike('name', row.job_position_name.trim()).single();
    if (!job) {
      console.log(`Fila ${i+2} (Folio ${row.folio}): ERROR - No se encontró el cargo '${row.job_position_name}'.`);
      errors++;
    }

    // 3. Check contract
    const { data: contract } = await adminSupabase.from('contracts').select('id, cost_unit, cost_unit_name, cost_center_code, cost_center_name, contract_number').ilike('contract_name', row.contract_name.trim()).single();
    if (!contract) {
      console.log(`Fila ${i+2} (Folio ${row.folio}): ERROR - No se encontró el contrato '${row.contract_name}'.`);
      errors++;
    }

    // 4. Check shift
    const { data: shift } = await adminSupabase.from('shifts').select('id').ilike('name', row.shift_name.trim()).single();
    if (!shift) {
      console.log(`Fila ${i+2} (Folio ${row.folio}): ERROR - No se encontró el turno '${row.shift_name}'.`);
      errors++;
    }
  }

  if (errors === 0) {
    console.log("✅ DRY RUN EXITOSO: Todos los correos, cargos, contratos y turnos existen en la base de datos y cruzan perfecto.");
  } else {
    console.log(`❌ DRY RUN FALLIDO: Se encontraron ${errors} errores de mapeo que deben corregirse antes de migrar.`);
  }
}

run();
