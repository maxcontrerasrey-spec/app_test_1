import { execFileSync } from "node:child_process";

const thresholdMs = Number(process.env.BI_DOTACION_MAX_WARM_MS ?? "1000");

if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
  throw new Error("BI_DOTACION_MAX_WARM_MS debe ser un numero positivo.");
}

const sql = `
begin;
create temporary table bi_dotacion_perf (
  scenario text,
  run_no integer,
  elapsed_ms numeric
) on commit drop;

do $perf$
declare
  actor_id uuid;
  management_name text;
  started_at timestamptz;
  payload jsonb;
  i integer;
begin
  select ur.user_id into actor_id
  from public.user_roles ur
  where ur.role_code in ('super_admin', 'administrador', 'admin')
  order by case when ur.role_code = 'super_admin' then 0 else 1 end
  limit 1;

  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select row.management_name into management_name
  from public.get_bi_headcount_by_management(null, null, null, null) row
  order by row.headcount desc
  limit 1;

  for i in 1..6 loop
    started_at := clock_timestamp();
    payload := public.get_bi_dotacion_dashboard(null, null, null, null);
    insert into bi_dotacion_perf values (
      'dashboard_all',
      i,
      round((extract(epoch from clock_timestamp() - started_at) * 1000)::numeric, 2)
    );

    started_at := clock_timestamp();
    payload := public.get_bi_dotacion_dashboard(null, null, null, array[management_name]);
    insert into bi_dotacion_perf values (
      'dashboard_management',
      i,
      round((extract(epoch from clock_timestamp() - started_at) * 1000)::numeric, 2)
    );
  end loop;
end
$perf$;

select scenario, run_no, elapsed_ms
from bi_dotacion_perf
order by scenario, run_no;
rollback;
`;

const output = execFileSync(
  "npx",
  ["--yes", "supabase", "db", "query", "--linked", "--output", "json", sql],
  { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
);
const start = output.indexOf("{");
const end = output.lastIndexOf("}");
if (start < 0 || end <= start) {
  throw new Error("Supabase CLI no devolvio una medicion JSON valida.");
}

const rows = JSON.parse(output.slice(start, end + 1)).rows ?? [];
const warmRows = rows.filter((row) => Number(row.run_no) > 1);
const failures = warmRows.filter((row) => Number(row.elapsed_ms) >= thresholdMs);

if (warmRows.length !== 10) {
  throw new Error(`Se esperaban 10 mediciones calientes y se recibieron ${warmRows.length}.`);
}
if (failures.length > 0) {
  throw new Error(
    `BI Dotacion excede ${thresholdMs} ms: ${failures
      .map((row) => `${row.scenario}#${row.run_no}=${row.elapsed_ms}ms`)
      .join(", ")}`
  );
}

const summary = Object.fromEntries(
  ["dashboard_all", "dashboard_management"].map((scenario) => {
    const values = warmRows
      .filter((row) => row.scenario === scenario)
      .map((row) => Number(row.elapsed_ms));
    return [scenario, { min_ms: Math.min(...values), max_ms: Math.max(...values) }];
  })
);

console.log(JSON.stringify({ ok: true, threshold_ms: thresholdMs, ...summary }, null, 2));
