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

function sqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function parsePayload(value, label) {
  if (value && typeof value === "object") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return JSON.parse(value);
  }

  throw new Error(`${label} did not return a JSON payload.`);
}

function getBeforeCount() {
  const result = runSupabaseQuery("select count(*) as count from public.service_entries;");
  return Number(result.rows?.[0]?.count ?? -1);
}

function runWriteSmoke() {
  const configuredUserId = process.env.SUPABASE_OPERATIONS_SMOKE_USER_ID?.trim();
  const userFilter = configuredUserId
    ? `and p.id = '${sqlLiteral(configuredUserId)}'::uuid`
    : "";

  return runSupabaseQuery(`
    begin;
    create temp table operations_write_smoke on commit drop as
    with editable_scope as (
      select
        p.id as user_id,
        p.email,
        c.id as contract_id,
        c.code as contract_code,
        coalesce(nullif(trim(c.contract_name), ''), c.code) as contract_name,
        bs.id as base_service_id,
        bs.external_key as service_external_key
      from public.operations_contract_editors oce
      join public.profiles p
        on p.id = oce.user_id
       and p.status = 'active'
      join public.contracts c
        on c.id = oce.contract_id
       and c.is_active = true
      join public.base_services bs
        on bs.contract_id = c.id
       and bs.is_active = true
      where oce.is_active = true
        ${userFilter}
        and exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.id
            and ur.role_code in ('operaciones_l_1', 'operaciones_l_2')
        )
      order by
        case when lower(p.email) = 'jose.orellana@busesjm.com' then 0 else 1 end,
        p.email,
        bs.external_key
      limit 1
    ),
    smoke_slot as (
      select
        day::date as service_date,
        shift_option.shift
      from editable_scope scope
      cross join generate_series(
        current_date + interval '3650 days',
        current_date + interval '3680 days',
        interval '1 day'
      ) as day
      cross join (values ('am'), ('pm')) as shift_option(shift)
      where not exists (
        select 1
        from public.service_entries se
        where se.service_date = day::date
          and se.shift = shift_option.shift
          and se.contract_id = scope.contract_id
          and se.base_service_id = scope.base_service_id
          and se.created_by = scope.user_id
      )
      order by day::date, shift_option.shift
      limit 1
    )
    select
      scope.user_id,
      scope.email,
      scope.contract_id,
      scope.contract_code,
      scope.contract_name,
      scope.base_service_id,
      scope.service_external_key,
      slot.service_date,
      slot.shift,
      (
        select count(*)
        from public.service_entries se
        where se.service_date = slot.service_date
          and se.shift = slot.shift
          and se.contract_id = scope.contract_id
          and se.base_service_id = scope.base_service_id
          and se.created_by = scope.user_id
      ) as slot_count_before,
      null::jsonb as first_payload,
      null::jsonb as second_payload,
      null::bigint as slot_count_after_first,
      null::bigint as slot_count_after_second
    from editable_scope scope
    cross join smoke_slot slot;

    select set_config('request.jwt.claim.sub', user_id::text, true)
    from operations_write_smoke;
    select set_config('request.jwt.claim.role', 'authenticated', true);

    update operations_write_smoke
       set first_payload = public.submit_service_entries_batch(jsonb_build_array(jsonb_build_object(
         'serviceId', 0,
         'contractCode', contract_code,
         'shift', shift,
         'serviceDate', service_date::text,
         'serviceExternalKey', service_external_key,
         'serviceExecutionStatus', 'not_performed',
         'serviceExecutionNote', 'Smoke rollback insert'
       )));

    update operations_write_smoke
       set slot_count_after_first = (
         select count(*)
         from public.service_entries se
         where se.service_date = operations_write_smoke.service_date
           and se.shift = operations_write_smoke.shift
           and se.contract_id = operations_write_smoke.contract_id
           and se.base_service_id = operations_write_smoke.base_service_id
           and se.created_by = operations_write_smoke.user_id
       );

    update operations_write_smoke
       set second_payload = public.submit_service_entries_batch(jsonb_build_array(jsonb_build_object(
         'serviceId', 0,
         'contractCode', contract_code,
         'shift', shift,
         'serviceDate', service_date::text,
         'serviceExternalKey', service_external_key,
         'serviceExecutionStatus', 'not_performed',
         'serviceExecutionNote', 'Smoke rollback update'
       )));

    update operations_write_smoke
       set slot_count_after_second = (
         select count(*)
         from public.service_entries se
         where se.service_date = operations_write_smoke.service_date
           and se.shift = operations_write_smoke.shift
           and se.contract_id = operations_write_smoke.contract_id
           and se.base_service_id = operations_write_smoke.base_service_id
           and se.created_by = operations_write_smoke.user_id
       );

    select
      user_id::text,
      email,
      contract_code,
      contract_name,
      service_external_key,
      service_date::text,
      shift,
      slot_count_before,
      first_payload,
      second_payload,
      slot_count_after_first,
      slot_count_after_second
    from operations_write_smoke;

    rollback;
  `);
}

function main() {
  const countBefore = getBeforeCount();
  assert(countBefore >= 0, "Could not read service_entries count before operations write smoke.");

  const smokeResult = runWriteSmoke();
  const row = smokeResult.rows?.[0];
  assert(row, "Operations write smoke did not find an editable contract and base service.");

  const firstPayload = parsePayload(row.first_payload, "First submit_service_entries_batch call");
  const secondPayload = parsePayload(row.second_payload, "Second submit_service_entries_batch call");

  assert(firstPayload.ok === true, "First submit_service_entries_batch call must succeed.");
  assert(secondPayload.ok === true, "Second submit_service_entries_batch call must succeed.");
  assert(Number(firstPayload.saved_count) === 1, "First submit_service_entries_batch call must save one row.");
  assert(Number(secondPayload.saved_count) === 1, "Second submit_service_entries_batch call must save one row.");
  assert(Number(row.slot_count_before) === 0, "Operations write smoke slot must start empty.");
  assert(Number(row.slot_count_after_first) === 1, "Operations write smoke insert must create one row inside the transaction.");
  assert(Number(row.slot_count_after_second) === 1, "Operations write smoke update must keep one row inside the transaction.");

  const countAfter = getBeforeCount();
  assert(countAfter === countBefore, "Operations write smoke changed persistent service_entries count.");

  console.log(
    JSON.stringify(
      {
        ok: true,
        smoke: "operations-write-rpc",
        transaction: "rolled back",
        authenticated_contract: "auth.uid simulated through request.jwt.claim.sub",
        user_email: row.email,
        contract_code: row.contract_code,
        contract_name: row.contract_name,
        service_external_key: Number(row.service_external_key),
        service_date: row.service_date,
        shift: row.shift,
        slot_count_before: Number(row.slot_count_before),
        slot_count_after_first: Number(row.slot_count_after_first),
        slot_count_after_second: Number(row.slot_count_after_second),
        persistent_count_before: countBefore,
        persistent_count_after: countAfter
      },
      null,
      2
    )
  );
}

main();
