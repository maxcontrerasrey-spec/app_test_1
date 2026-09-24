const supabaseUrl = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const documentQueueSecret = process.env.BUK_DOCUMENT_QUEUE_WEBHOOK_SECRET || "";

if (!supabaseUrl || !serviceRoleKey || !documentQueueSecret) {
  throw new Error(
    "Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o BUK_DOCUMENT_QUEUE_WEBHOOK_SECRET."
  );
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "x-buk-document-queue-secret": documentQueueSecret,
  "Content-Type": "application/json"
};

const response = await fetch(`${supabaseUrl}/functions/v1/sync-buk-candidates`, {
  method: "POST",
  headers,
  body: JSON.stringify({ mode: "documents", limit: 3 })
});
const body = await response.text();

if (!response.ok) {
  throw new Error(`La cola documental BUK rechazo la ejecucion (${response.status}): ${body.slice(0, 500)}`);
}

let result;
try {
  result = JSON.parse(body);
} catch {
  throw new Error("La cola documental BUK no retorno una respuesta JSON valida.");
}

const processed = Array.isArray(result?.processed) ? result.processed : [];
const failures = processed.filter((row) => row?.status === "error");

console.log(JSON.stringify({
  claimed: Number(result?.claimed ?? 0),
  processed: processed.length,
  failures: failures.length,
  result
}, null, 2));
