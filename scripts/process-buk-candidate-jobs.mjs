const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const rawJobIds = process.argv.slice(2);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

const jobIds = [...new Set(rawJobIds.map((value) => value.trim()).filter(Boolean))];
if (jobIds.length === 0 || jobIds.length > 20 || jobIds.some((jobId) => !uuidPattern.test(jobId))) {
  throw new Error("Indica entre 1 y 20 UUID de jobs BUK validos.");
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json"
};

const dispatchResponse = await fetch(`${supabaseUrl}/functions/v1/sync-buk-candidates`, {
  method: "POST",
  headers,
  body: JSON.stringify({ jobIds })
});
const dispatchText = await dispatchResponse.text();
if (!dispatchResponse.ok) {
  throw new Error(`El worker BUK rechazo la ejecucion (${dispatchResponse.status}).`);
}

let dispatchResult = null;
try {
  dispatchResult = JSON.parse(dispatchText);
} catch {
  throw new Error("El worker BUK no retorno una respuesta JSON valida.");
}

const encodedIds = jobIds.map((jobId) => `\"${jobId}\"`).join(",");
const statusUrl = new URL(`${supabaseUrl}/rest/v1/buk_sync_jobs`);
statusUrl.searchParams.set("id", `in.(${encodedIds})`);
statusUrl.searchParams.set(
  "select",
  "id,recruitment_case_candidate_id,status,buk_employee_id,error_message,attempts,started_at,finished_at"
);

let rows = [];
for (let attempt = 1; attempt <= 60; attempt += 1) {
  const statusResponse = await fetch(statusUrl, { headers });
  if (!statusResponse.ok) {
    throw new Error(`No fue posible verificar los jobs BUK (${statusResponse.status}).`);
  }
  rows = await statusResponse.json();
  if (
    Array.isArray(rows) &&
    rows.length === jobIds.length &&
    rows.every((row) => row.status === "success" || row.status === "error")
  ) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

const rowsById = new Map(rows.map((row) => [row.id, row]));
const orderedRows = jobIds.map((jobId) => rowsById.get(jobId)).filter(Boolean);
const failures = orderedRows.filter(
  (row) => row.status !== "success" || !String(row.buk_employee_id || "").trim()
);

console.log(JSON.stringify({ dispatch: dispatchResult, jobs: orderedRows }, null, 2));

if (orderedRows.length !== jobIds.length) {
  throw new Error("No fue posible obtener el estado de todos los jobs solicitados.");
}
if (failures.length > 0) {
  throw new Error(
    `Fallaron ${failures.length} job(s) BUK: ${failures.map((row) => row.id).join(", ")}`
  );
}
