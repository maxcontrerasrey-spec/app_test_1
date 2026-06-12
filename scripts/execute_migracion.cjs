const xlsx = require('@mylinkpi/xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6YmxtYmFobm95bnRyaGlzdGVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwMDQyOCwiZXhwIjoyMDk0Mzc2NDI4fQ.CUd9-WlYKWXKJPhqQiExjqELXYMkuzIviHO8GnQGqpk";
const adminSupabase = createClient("https://pzblmbahnoyntrhistea.supabase.co", supabaseServiceKey);

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'number') {
    // Excel serial number (days since 1900)
    // 25569 is the offset between 1900-01-01 and 1970-01-01
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString();
  }
  return new Date(val).toISOString();
}

async function run() {
  const workbook = xlsx.readFile('migracion_folios.xlsx', { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\nIniciando inyección a base de datos de ${data.length} folios...\n`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // Lookups
    const { data: profile } = await adminSupabase.from('profiles').select('id, full_name, job_title').eq('email', row.requester_email.trim()).single();
    const { data: job } = await adminSupabase.from('job_positions').select('*').ilike('name', row.job_position_name.trim()).single();
    const { data: contract } = await adminSupabase.from('contracts').select('*').ilike('contract_name', row.contract_name.trim()).single();
    const { data: shift } = await adminSupabase.from('shifts').select('*').ilike('name', row.shift_name.trim()).single();

    const dbStatus = row.status === 'APPROVED' ? 'approved' : 'pending_contracts_control';

    // Parse dates robustly
    const reqEntryDate = parseDate(row.requested_entry_date).split('T')[0];
    const startDate = parseDate(row.start_date).split('T')[0];
    const endDate = parseDate(row.end_date).split('T')[0];
    
    let createdAtIso = new Date().toISOString();
    if (row.created_at) {
        createdAtIso = parseDate(row.created_at);
    }

    const requestPayload = {
      folio: row.folio ? String(row.folio) : null,
      requester_id: profile.id,
      requester_name: profile.full_name,
      requester_job_title: profile.job_title || 'N/A',
      requester_email: row.requester_email.trim(),
      requested_entry_date: reqEntryDate,
      job_position_id: job.id,
      job_position_name: job.name,
      vacancies: Number(row.vacancies),
      contract_id: contract.id,
      contract_name: contract.contract_name,
      contract_number: contract.contract_number,
      cost_unit: contract.cost_unit,
      cost_unit_name: contract.cost_unit_name,
      cost_center_code: contract.cost_center_code,
      cost_center_name: contract.cost_center_name,
      start_date: startDate,
      end_date: endDate,
      campamento: String(row.campamento).toUpperCase() === 'SI',
      pasajes: String(row.pasajes).toUpperCase() === 'SI',
      other_benefits: null,
      salary_offer: Number(row.salary_offer),
      shift_id: shift.id,
      shift_name: shift.name,
      requester_signed: true,
      status: dbStatus,
      submitted_by: profile.id,
      submitted_at: createdAtIso,
      created_at: createdAtIso,
      updated_at: createdAtIso
    };

    const { data: insertedRequest, error: reqError } = await adminSupabase
      .from('hiring_requests')
      .insert(requestPayload)
      .select('id')
      .single();

    if (reqError) {
      console.log(`ERROR insertando Folio ${row.folio}: ${reqError.message}`);
      continue;
    }

    // Insert approval logs if approved
    if (dbStatus === 'approved' && row.acted_at) {
        let actedAtIso = parseDate(row.acted_at);
        
        // Simular la firma de Control Contratos
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'CONTROL_CONTRATOS',
            step_name: 'Control de Contratos',
            approver_user_id: profile.id, // we put the same user as placeholder
            approver_name: 'Migración Histórica',
            status: 'COMPLETED',
            decision: 'APPROVED',
            comment: 'Aprobado históricamente antes de la plataforma.',
            created_at: actedAtIso,
            acted_at: actedAtIso
        });
        
        // Simular caso de reclutamiento
        await adminSupabase.from('recruitment_cases').insert({
           hiring_request_id: insertedRequest.id,
           code: `RC-${String(row.folio).padStart(4, '0')}`,
           title: `[Migración] ${job.name} - ${contract.contract_name}`,
           status: 'open',
           contract_id: contract.id,
           contract_name: contract.contract_name,
           job_position_id: job.id,
           job_position_name: job.name,
           requested_vacancies: Number(row.vacancies),
           filled_vacancies: 0,
           created_at: actedAtIso,
           updated_at: actedAtIso
        });
    }

    console.log(`Folio ${row.folio} migrado exitosamente.`);
  }

  console.log(`\n🎉 MIGRACION FINALIZADA COMPLETAMENTE.`);
}

run();
