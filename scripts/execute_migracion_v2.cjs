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
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString();
  }
  return new Date(val).toISOString();
}

async function run() {
  const workbook = xlsx.readFile('migracion_folios.xlsx', { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log(`\nIniciando limpieza previa y posterior inyección de ${data.length} folios...\n`);

  const foliosList = data.map(r => String(r.folio));

  // 1. Limpieza de cualquier rastro previo para evitar duplicados o estados inconsistentes
  console.log("Eliminando rastros de intentos anteriores...");
  const { data: existing } = await adminSupabase.from('hiring_requests').select('id').in('folio', foliosList);
  if (existing && existing.length > 0) {
      const ids = existing.map(e => e.id);
      await adminSupabase.from('hiring_request_audit_log').delete().in('hiring_request_id', ids);
      await adminSupabase.from('hiring_request_approvals').delete().in('hiring_request_id', ids);
      await adminSupabase.from('recruitment_case_audit_log').delete().in('recruitment_case_id', ids); // in case
      await adminSupabase.from('recruitment_cases').delete().in('hiring_request_id', ids);
      await adminSupabase.from('hiring_requests').delete().in('id', ids);
  }

  // 2. Inyección
  console.log("Iniciando inyección rigurosa...");

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // Lookups
    const { data: profile } = await adminSupabase.from('profiles').select('id, full_name, email, job_title').eq('email', row.requester_email.trim()).single();
    const { data: job } = await adminSupabase.from('job_positions').select('*').ilike('name', row.job_position_name.trim()).single();
    const { data: contract } = await adminSupabase.from('contracts').select('*').ilike('contract_name', row.contract_name.trim()).single();
    const { data: shift } = await adminSupabase.from('shifts').select('*').ilike('name', row.shift_name.trim()).single();

    const dbStatus = row.status === 'APPROVED' ? 'approved' : 'pending_contracts_control';

    const reqEntryDate = parseDate(row.requested_entry_date).split('T')[0];
    const startDate = parseDate(row.start_date).split('T')[0];
    const endDate = parseDate(row.end_date).split('T')[0];
    
    let createdAtIso = new Date().toISOString();
    if (row.created_at) {
        createdAtIso = parseDate(row.created_at);
    }

    const requestPayload = {
      folio: String(row.folio),
      requester_id: profile.id,
      requester_name: profile.full_name,
      requester_job_title: profile.job_title || 'N/A',
      requester_email: profile.email,
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
      console.log(`ERROR insertando hr Folio ${row.folio}: ${reqError.message}`);
      continue;
    }

    // Insert approvals
    if (dbStatus === 'approved' && row.acted_at) {
        let actedAtIso = parseDate(row.acted_at);
        
        // Firma solicitante
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'requester_signature',
            step_name: 'Firma solicitante',
            step_order: 1,
            approver_user_id: profile.id,
            approver_name: profile.full_name,
            approver_email: profile.email,
            status: 'approved',
            decided_at: createdAtIso,
            created_at: createdAtIso,
            updated_at: createdAtIso
        });

        // Aprobación Operativa (histórica)
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'operational_approval',
            step_name: 'Aprobación operativa',
            step_order: 2,
            approver_user_id: profile.id,
            approver_name: profile.full_name,
            approver_email: profile.email,
            status: 'approved',
            comments: 'Aprobado históricamente antes de la plataforma.',
            decided_at: actedAtIso,
            created_at: actedAtIso,
            updated_at: actedAtIso
        });

        // Control Contratos (histórica)
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'contracts_control',
            step_name: 'Control de contratos',
            step_order: 3,
            approver_user_id: profile.id,
            approver_name: 'Migración Histórica',
            approver_email: profile.email,
            status: 'approved',
            comments: 'Aprobado históricamente antes de la plataforma.',
            decided_at: actedAtIso,
            created_at: actedAtIso,
            updated_at: actedAtIso
        });
        
        // Simular caso de reclutamiento
        const rcPayload = {
           hiring_request_id: insertedRequest.id,
           case_code: `RC-${String(row.folio).padStart(4, '0')}`,
           title: `[Migración] ${job.name} - ${contract.contract_name}`,
           status: 'open',
           requested_vacancies: Number(row.vacancies),
           filled_vacancies: 0,
           contract_id: contract.id,
           contract_name: contract.contract_name,
           job_position_id: job.id,
           job_position_name: job.name,
           cost_center_code: contract.cost_center_code,
           cost_center_name: contract.cost_center_name,
           opened_by: profile.id,
           opened_at: actedAtIso,
           created_at: actedAtIso,
           updated_at: actedAtIso
        };

        const { error: rcError } = await adminSupabase.from('recruitment_cases').insert(rcPayload);
        if (rcError) {
           console.log(`ERROR insertando RC Folio ${row.folio}: ${rcError.message}`);
        }
    } else {
        // If pending, just insert the pending approvals so it shows up in the approval queues
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'requester_signature',
            step_name: 'Firma solicitante',
            step_order: 1,
            approver_user_id: profile.id,
            approver_name: profile.full_name,
            approver_email: profile.email,
            status: 'approved',
            decided_at: createdAtIso,
            created_at: createdAtIso,
            updated_at: createdAtIso
        });

        // The next ones are pending
        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'operational_approval',
            step_name: 'Aprobación operativa',
            step_order: 2,
            approver_user_id: profile.id,
            approver_name: profile.full_name,
            approver_email: profile.email,
            status: 'pending',
            created_at: createdAtIso,
            updated_at: createdAtIso
        });

        await adminSupabase.from('hiring_request_approvals').insert({
            hiring_request_id: insertedRequest.id,
            step_code: 'contracts_control',
            step_name: 'Control de contratos',
            step_order: 3,
            approver_user_id: profile.id,
            approver_name: profile.full_name,
            approver_email: profile.email,
            status: 'pending',
            created_at: createdAtIso,
            updated_at: createdAtIso
        });
    }

    console.log(`Folio ${row.folio} inyectado rigurosamente.`);
  }

  console.log(`\n🎉 MIGRACION RIGUROSA FINALIZADA COMPLETAMENTE.`);
}

run();
