import { execFileSync } from "node:child_process";

function runSupabaseQuery(sql, { expectFailure = false } = {}) {
  const args = ["--yes", "supabase", "db", "query", "--linked", "--output", "json", sql];

  try {
    const output = execFileSync("npx", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    if (expectFailure) {
      throw new Error("Expected query to fail, but it succeeded.");
    }

    return parseSupabaseJson(output);
  } catch (error) {
    if (expectFailure) {
      const stderr = stripAnsi(String(error.stderr ?? ""));
      const stdout = stripAnsi(String(error.stdout ?? ""));
      return { failed: true, output: `${stdout}\n${stderr}` };
    }

    throw error;
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

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function getSmokeUserId() {
  const configuredUserId = process.env.SUPABASE_SMOKE_USER_ID?.trim();

  if (configuredUserId) {
    return configuredUserId;
  }

  const result = runSupabaseQuery(`
    select p.id::text as user_id
      from public.profiles p
     where p.status = 'active'
       and exists (
         select 1
           from public.user_roles ur
           join public.app_roles ar
             on ar.code = ur.role_code
          where ur.user_id = p.id
            and ar.is_active = true
       )
     order by p.created_at desc nulls last
     limit 1;
  `);

  const userId = result.rows?.[0]?.user_id;

  if (!userId) {
    throw new Error("No active user with at least one active role was found for dashboard smoke.");
  }

  return userId;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const unauthenticated = runSupabaseQuery("select public.get_my_effective_permissions();", {
    expectFailure: true
  });

  assert(
    unauthenticated.output.includes("Usuario no autenticado"),
    "get_my_effective_permissions() must reject calls without auth.uid()."
  );

  const smokeUserId = getSmokeUserId();
  const smokeResult = runSupabaseQuery(`
    begin read only;
    select set_config('request.jwt.claim.sub', '${smokeUserId.replace(/'/g, "''")}', true);
    select set_config('request.jwt.claim.role', 'authenticated', true);

    with permissions as (
      select public.get_my_effective_permissions() as payload
    ),
    dashboard as (
      select public.get_dashboard_home_bundle(2) as payload
    )
    select
      jsonb_typeof(permissions.payload) = 'object' as permissions_is_object,
      jsonb_typeof(permissions.payload -> 'profile') = 'object' as profile_is_object,
      jsonb_typeof(permissions.payload -> 'app_roles') = 'array' as app_roles_is_array,
      jsonb_typeof(permissions.payload -> 'accessible_modules') = 'array' as modules_is_array,
      jsonb_array_length(permissions.payload -> 'app_roles') as app_role_count,
      jsonb_array_length(permissions.payload -> 'accessible_modules') as module_count,
      jsonb_typeof(dashboard.payload) = 'object' as dashboard_is_object,
      jsonb_typeof(dashboard.payload -> 'tasks_data') = 'array' as tasks_is_array,
      jsonb_typeof(dashboard.payload -> 'approval_tracking_data') = 'array' as approvals_is_array,
      jsonb_typeof(dashboard.payload -> 'active_folios_data') = 'array' as active_folios_is_array,
      jsonb_typeof(dashboard.payload -> 'birthdays_data') = 'array' as birthdays_is_array,
      jsonb_typeof(dashboard.payload -> 'operational_summary_data') = 'object' as operational_summary_is_object
    from permissions, dashboard;

    rollback;
  `);

  const row = smokeResult.rows?.[0];
  assert(row, "Dashboard smoke did not return a validation row.");
  assert(row.permissions_is_object === true, "Permissions payload must be an object.");
  assert(row.profile_is_object === true, "Permissions payload must include a profile object.");
  assert(row.app_roles_is_array === true, "Permissions app_roles must be an array.");
  assert(row.modules_is_array === true, "Permissions accessible_modules must be an array.");
  assert(Number(row.app_role_count) > 0, "Smoke user must have at least one active role.");
  assert(Number(row.module_count) > 0, "Smoke user must have at least one accessible module.");
  assert(row.dashboard_is_object === true, "Dashboard payload must be an object.");
  assert(row.tasks_is_array === true, "Dashboard tasks_data must be an array.");
  assert(row.approvals_is_array === true, "Dashboard approval_tracking_data must be an array.");
  assert(row.active_folios_is_array === true, "Dashboard active_folios_data must be an array.");
  assert(row.birthdays_is_array === true, "Dashboard birthdays_data must be an array.");
  assert(
    row.operational_summary_is_object === true,
    "Dashboard operational_summary_data must be an object."
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        smoke: "dashboard-rpc",
        authenticated_contract: "auth.uid simulated through request.jwt.claim.sub",
        app_role_count: Number(row.app_role_count),
        module_count: Number(row.module_count)
      },
      null,
      2
    )
  );
}

main();
