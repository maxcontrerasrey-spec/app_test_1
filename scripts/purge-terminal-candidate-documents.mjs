import fs from "fs";

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return process.env;
  }
}

function requireEnv(value, label) {
  const normalized = (value ?? "").toString().trim();
  if (!normalized) {
    throw new Error(`Missing ${label}`);
  }

  return normalized;
}

function parseArgs(argv) {
  const options = {
    limit: 250,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--limit") {
      const rawValue = argv[index + 1];
      const parsed = Number.parseInt(rawValue ?? "", 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Invalid --limit value");
      }
      options.limit = parsed;
      index += 1;
    }
  }

  return options;
}

async function main() {
  const env = {
    ...process.env,
    ...readEnvFile(),
  };
  const options = parseArgs(process.argv.slice(2));
  const supabaseUrl = requireEnv(
    env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    "SUPABASE_URL",
  ).replace(/\/$/, "");
  const webhookSecret = requireEnv(
    env.CANDIDATE_DOCUMENT_CLEANUP_WEBHOOK_SECRET,
    "CANDIDATE_DOCUMENT_CLEANUP_WEBHOOK_SECRET",
  );

  const response = await fetch(`${supabaseUrl}/functions/v1/purge-candidate-documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({
      limit: options.limit,
      sweepTerminalCandidates: true,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `purge-candidate-documents failed with ${response.status}: ${JSON.stringify(payload)}`,
    );
  }

  const processed = Array.isArray(payload?.processed) ? payload.processed : [];
  const successCount = processed.filter((row) => row?.status === "success").length;
  const errorRows = processed.filter((row) => row?.status === "error");

  console.log(JSON.stringify({
    ok: errorRows.length === 0,
    mode: payload?.mode ?? "unknown",
    sweepQueued: Number(payload?.sweepQueued ?? 0),
    processedCount: processed.length,
    successCount,
    errorCount: errorRows.length,
    errors: errorRows,
  }, null, 2));

  if (errorRows.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
