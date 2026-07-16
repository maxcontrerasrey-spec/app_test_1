import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MANIFEST_PATH =
  process.env.FRONTEND_AUTH_SMOKE_MANIFEST || "tests/smoke/frontend-authenticated.scenarios.json";

const REQUIRED_VARIABLES = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
const REQUIRED = process.env.FRONTEND_AUTH_SMOKE_SECRETS_REQUIRED === "1";

function runGh(args) {
  return execFileSync("gh", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (!Array.isArray(manifest.scenarios)) {
    throw new Error("Frontend auth smoke manifest must declare scenarios[].");
  }

  return manifest.scenarios.map((scenario) => ({
    id: String(scenario.id ?? ""),
    emailEnv: String(scenario.emailEnv ?? ""),
    passwordEnv: String(scenario.passwordEnv ?? "")
  }));
}

function listNames(args) {
  const output = runGh(args);
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) {
    throw new Error(`Unexpected gh JSON output for: gh ${args.join(" ")}`);
  }

  return new Set(
    parsed
      .map((entry) => entry?.name)
      .filter((name) => typeof name === "string" && name.length > 0)
  );
}

function buildRequiredSecretNames(scenarios) {
  const names = new Set();

  for (const scenario of scenarios) {
    if (scenario.emailEnv) {
      names.add(scenario.emailEnv);
    }

    if (scenario.passwordEnv) {
      names.add(scenario.passwordEnv);
    }
  }

  return [...names].sort();
}

function buildScenarioResults(scenarios, secretNames) {
  return scenarios.map((scenario) => {
    const requiredSecrets = [scenario.emailEnv, scenario.passwordEnv].filter(Boolean);
    const missingSecrets = requiredSecrets.filter((name) => !secretNames.has(name));

    return {
      id: scenario.id,
      required_secret_count: requiredSecrets.length,
      configured_secret_count: requiredSecrets.length - missingSecrets.length,
      missing_secrets: missingSecrets,
      status: missingSecrets.length === 0 ? "configured" : "missing_secrets"
    };
  });
}

function main() {
  const scenarios = readManifest();
  const secretNames = listNames(["secret", "list", "--app", "actions", "--json", "name"]);
  const variableNames = listNames(["variable", "list", "--json", "name"]);
  const requiredSecrets = buildRequiredSecretNames(scenarios);
  const missingSecrets = requiredSecrets.filter((name) => !secretNames.has(name));
  const missingVariables = REQUIRED_VARIABLES.filter((name) => !variableNames.has(name));
  const scenarioResults = buildScenarioResults(scenarios, secretNames);

  const payload = {
    ok: !REQUIRED || (missingSecrets.length === 0 && missingVariables.length === 0),
    audit: "frontend-auth-smoke-secrets",
    manifest: MANIFEST_PATH,
    required: REQUIRED,
    required_secret_count: requiredSecrets.length,
    configured_secret_count: requiredSecrets.length - missingSecrets.length,
    missing_secrets: missingSecrets,
    required_variable_count: REQUIRED_VARIABLES.length,
    configured_variable_count: REQUIRED_VARIABLES.length - missingVariables.length,
    missing_variables: missingVariables,
    scenarios: scenarioResults
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
