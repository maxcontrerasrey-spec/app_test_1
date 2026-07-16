import { execFileSync } from "node:child_process";

function runSupabaseQuery(sql) {
  const output = execFileSync(
    "npx",
    ["--yes", "supabase", "db", "query", "--linked", "--output", "json", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  return parseSupabaseJson(output);
}

function parseSupabaseJson(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Supabase CLI did not return JSON output.");
  }

  return JSON.parse(output.slice(start, end + 1));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getSmokeUserId() {
  const configuredUserId = process.env.SUPABASE_OPERATIONS_SMOKE_USER_ID?.trim();

  if (configuredUserId) {
    return configuredUserId;
  }

  const result = runSupabaseQuery(`
    with operations_users as (
      select
        p.id::text as user_id,
        count(editable_contract.id) as editable_contract_count,
        max(p.created_at) as profile_created_at
      from public.profiles p
      join public.user_roles ur
        on ur.user_id = p.id
      join public.app_roles ar
        on ar.code = ur.role_code
       and ar.is_active = true
      join public.role_module_access rma
        on rma.role_code = ur.role_code
       and rma.can_view = true
       and rma.module_code = 'operaciones'
      join public.app_modules am
        on am.code = rma.module_code
       and am.is_active = true
      left join public.operations_contract_editors oce
        on oce.user_id = p.id
       and oce.is_active = true
      left join public.contracts editable_contract
        on editable_contract.id = oce.contract_id
       and editable_contract.is_active = true
      where p.status = 'active'
      group by p.id
    )
    select user_id
      from operations_users
     order by editable_contract_count desc, profile_created_at desc nulls last
     limit 1;
  `);

  const userId = result.rows?.[0]?.user_id;

  if (!userId) {
    throw new Error("No active user with operations module access was found for operations smoke.");
  }

  return userId;
}

function main() {
  const unauthenticated = runSupabaseQuery(`
    select
      (select count(*) from public.user_contracts) as user_contracts_without_claim,
      (select count(*) from public.operations_editable_contracts) as editable_contracts_without_claim;
  `);

  const unauthenticatedRow = unauthenticated.rows?.[0];
  assert(unauthenticatedRow, "Unauthenticated operations smoke did not return a validation row.");
  assert(
    Number(unauthenticatedRow.user_contracts_without_claim) === 0,
    "user_contracts must not expose rows without auth.uid()."
  );
  assert(
    Number(unauthenticatedRow.editable_contracts_without_claim) === 0,
    "operations_editable_contracts must not expose rows without auth.uid()."
  );

  const smokeUserId = getSmokeUserId();
  const smokeResult = runSupabaseQuery(`
    begin read only;
    select set_config('request.jwt.claim.sub', '${smokeUserId.replace(/'/g, "''")}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);

    with
    visible_contracts as (
      select count(*) as count
      from public.user_contracts uc
      where uc.user_id = '${smokeUserId.replace(/'/g, "''")}'::uuid
    ),
    editable_contracts as (
      select count(*) as count
      from public.operations_editable_contracts
    ),
    base_services as (
      select count(*) as count
      from public.base_services
    ),
    active_contracts as (
      select count(*) as count
      from public.contracts
      where is_active = true
    ),
    active_equipment as (
      select count(*) as count
      from public.equipment
      where is_active = true
    ),
    dashboard_entries as (
      select count(*) as count
      from public.service_entries
      where service_date between current_date and current_date
    ),
    export_entries as (
      select count(*) as count
      from public.service_entries
      where service_date between current_date - interval '30 days' and current_date
    )
    select
      visible_contracts.count as visible_contract_count,
      editable_contracts.count as editable_contract_count,
      base_services.count as base_service_count,
      active_contracts.count as active_contract_count,
      active_equipment.count as active_equipment_count,
      dashboard_entries.count as dashboard_entry_count,
      export_entries.count as export_entry_count
    from visible_contracts, editable_contracts, base_services, active_contracts, active_equipment, dashboard_entries, export_entries;

    rollback;
  `);

  const row = smokeResult.rows?.[0];
  assert(row, "Operations smoke did not return a validation row.");
  assert(Number(row.visible_contract_count) > 0, "Operations user must have visible contracts.");
  assert(Number(row.editable_contract_count) > 0, "Operations user must have editable contracts.");
  assert(Number(row.base_service_count) > 0, "Operations base_services must be readable.");
  assert(Number(row.active_contract_count) > 0, "Operations active contracts catalog must be readable.");
  assert(Number(row.active_equipment_count) > 0, "Operations active equipment catalog must be readable.");
  assert(Number(row.dashboard_entry_count) >= 0, "Operations dashboard service_entries count is invalid.");
  assert(Number(row.export_entry_count) >= 0, "Operations export service_entries count is invalid.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        smoke: "operations-rpc",
        authenticated_contract: "auth.uid simulated through request.jwt.claim.sub",
        visible_contract_count: Number(row.visible_contract_count),
        editable_contract_count: Number(row.editable_contract_count),
        base_service_count: Number(row.base_service_count),
        active_contract_count: Number(row.active_contract_count),
        active_equipment_count: Number(row.active_equipment_count),
        dashboard_entry_count: Number(row.dashboard_entry_count),
        export_entry_count: Number(row.export_entry_count)
      },
      null,
      2
    )
  );
}

main();
