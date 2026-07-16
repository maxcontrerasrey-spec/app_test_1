import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MANIFEST_PATH =
  process.env.FRONTEND_AUTH_SMOKE_MANIFEST || "tests/smoke/frontend-authenticated.scenarios.json";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseSupabaseJson(output) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Supabase CLI did not return JSON output.");
  }

  return JSON.parse(output.slice(start, end + 1));
}

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

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function maskEmail(value) {
  const [localPart, domain] = String(value ?? "").split("@");
  if (!localPart || !domain) {
    return null;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function readManifestScenarios() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assert(Array.isArray(manifest.scenarios), "Frontend auth smoke manifest must declare scenarios[].");
  return manifest.scenarios.map((scenario) => ({
    id: scenario.id,
    role: scenario.role,
    targetPath: scenario.targetPath,
    requiredModule: resolveRequiredModule(scenario.targetPath)
  }));
}

function resolveRequiredModule(targetPath) {
  if (targetPath === "/") {
    return "";
  }

  if (targetPath.startsWith("/operaciones")) {
    return "operaciones";
  }

  if (targetPath.startsWith("/certificados")) {
    return "certificados";
  }

  return "";
}

function buildScenarioValues(scenarios) {
  return scenarios
    .map(
      (scenario) =>
        `(${sqlString(scenario.id)}, ${sqlString(scenario.role)}, ${sqlString(
          scenario.targetPath
        )}, nullif(${sqlString(scenario.requiredModule)}, ''))`
    )
    .join(",\n      ");
}

function main() {
  const required = process.env.SUPABASE_AUTH_SMOKE_CANDIDATES_REQUIRED === "1";
  const scenarios = readManifestScenarios();
  const query = `
    with scenario(id, role_code, target_path, required_module) as (
      values
      ${buildScenarioValues(scenarios)}
    ),
    candidate_base as (
      select
        s.id as scenario_id,
        s.role_code,
        s.target_path,
        s.required_module,
        p.id::text as user_id,
        p.email,
        p.full_name,
        p.status,
        coalesce(p.must_reset_password, false) as must_reset_password,
        p.aup_accepted_at is not null as aup_accepted,
        p.is_super_admin,
        exists (
          select 1
          from public.user_roles ur
          join public.app_roles ar
            on ar.code = ur.role_code
           and ar.is_active = true
          where ur.user_id = p.id
            and ur.role_code = s.role_code
        ) as has_required_role,
        (
          s.required_module is null
          or exists (
            select 1
            from public.user_roles ur
            join public.role_module_access rma
              on rma.role_code = ur.role_code
             and rma.module_code = s.required_module
             and rma.can_view = true
            join public.app_modules am
              on am.code = rma.module_code
             and am.is_active = true
            where ur.user_id = p.id
          )
        ) as has_required_module,
        case
          when s.id = 'operations-l1-summary' then (
            select count(*)
            from public.operations_contract_editors oce
            join public.contracts c
              on c.id = oce.contract_id
             and c.is_active = true
            where oce.user_id = p.id
              and oce.is_active = true
          )
          else null
        end as editable_contract_count,
        case
          when s.id = 'instructor-form' then (
            select count(*)
            from public.competency_instructors ci
            where ci.user_id = p.id
              and ci.status = 'active'
          )
          else null
        end as linked_instructor_count
      from scenario s
      join public.profiles p
        on p.status = 'active'
    ),
    eligible as (
      select *,
        (
          status = 'active'
          and must_reset_password = false
          and aup_accepted = true
          and has_required_role = true
          and has_required_module = true
          and (
            scenario_id <> 'operations-l1-summary'
            or coalesce(editable_contract_count, 0) > 0
          )
          and (
            scenario_id <> 'instructor-form'
            or coalesce(linked_instructor_count, 0) > 0
          )
        ) as is_eligible
      from candidate_base
    ),
    ranked as (
      select *,
        row_number() over (
          partition by scenario_id
          order by
            is_eligible desc,
            is_super_admin asc,
            email asc
        ) as rn
      from eligible
      where is_eligible = true
    )
    select
      s.id as scenario_id,
      s.role_code,
      s.target_path,
      s.required_module,
      count(r.user_id) as eligible_candidate_count,
      max(r.user_id) filter (where r.rn = 1) as recommended_user_id,
      max(r.email) filter (where r.rn = 1) as recommended_email,
      max(r.full_name) filter (where r.rn = 1) as recommended_full_name,
      max(r.editable_contract_count) filter (where r.rn = 1) as editable_contract_count,
      max(r.linked_instructor_count) filter (where r.rn = 1) as linked_instructor_count
    from scenario s
    left join ranked r
      on r.scenario_id = s.id
    group by s.id, s.role_code, s.target_path, s.required_module
    order by s.id;
  `;

  const result = runSupabaseQuery(query);
  const scenariosResult = (result.rows ?? []).map((row) => ({
    id: row.scenario_id,
    role: row.role_code,
    target_path: row.target_path,
    required_module: row.required_module ?? null,
    status: Number(row.eligible_candidate_count) > 0 ? "candidate_found" : "missing_candidate",
    eligible_candidate_count: Number(row.eligible_candidate_count),
    recommended_user_id: row.recommended_user_id ?? null,
    recommended_email_masked: maskEmail(row.recommended_email),
    recommended_full_name: row.recommended_full_name ?? null,
    editable_contract_count:
      row.editable_contract_count === null || row.editable_contract_count === undefined
        ? null
        : Number(row.editable_contract_count),
    linked_instructor_count:
      row.linked_instructor_count === null || row.linked_instructor_count === undefined
        ? null
        : Number(row.linked_instructor_count)
  }));

  const missing = scenariosResult.filter((scenario) => scenario.status === "missing_candidate");

  const payload = {
    ok: !required || missing.length === 0,
    smoke: "frontend-auth-candidates",
    manifest: MANIFEST_PATH,
    required,
    scenario_count: scenariosResult.length,
    candidate_found_count: scenariosResult.length - missing.length,
    missing_candidate_count: missing.length,
    scenarios: scenariosResult
  };

  const output = JSON.stringify(payload, null, 2);
  if (payload.ok) {
    console.log(output);
    return;
  }

  console.error(output);
  process.exit(1);
}

main();
