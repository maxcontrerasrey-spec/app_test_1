import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { loadEnv } from "vite";

const MANIFEST_PATH =
  process.env.FRONTEND_AUTH_SMOKE_MANIFEST || "tests/smoke/frontend-authenticated.scenarios.json";
const ENV_NAME_PATTERN = /^FRONTEND_AUTH_SMOKE_[A-Z0-9_]+_(EMAIL|PASSWORD)$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const KNOWN_ROLES = new Set([
  "admin",
  "aprobador_folios",
  "reclutamiento",
  "control_contratos",
  "operaciones",
  "gerencia",
  "director_eje",
  "director_op",
  "gerente_general",
  "operaciones_l_1",
  "operaciones_l_2",
  "administrativo",
  "jefe_administrativo",
  "certificaciones",
  "instructor"
]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readString(record, key) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value, fieldName) {
  const path = value.trim();
  assert(path.startsWith("/"), `${fieldName} debe comenzar con "/".`);
  assert(!path.includes("://"), `${fieldName} debe ser una ruta interna, no URL absoluta.`);
  return path;
}

function validateScenario(value, index) {
  assert(value && typeof value === "object" && !Array.isArray(value), `Escenario ${index + 1} invalido.`);

  const id = readString(value, "id");
  const role = readString(value, "role");
  const emailEnv = readString(value, "emailEnv");
  const passwordEnv = readString(value, "passwordEnv");
  const targetPath = normalizePath(readString(value, "targetPath"), `${id || `scenario_${index + 1}`}.targetPath`);
  const expectedPath = readString(value, "expectedPath")
    ? normalizePath(readString(value, "expectedPath"), `${id || `scenario_${index + 1}`}.expectedPath`)
    : "";
  const expectedHeading = readString(value, "expectedHeading");
  const description = readString(value, "description");
  const requireModuleAccess = value.requireModuleAccess === true;

  assert(ID_PATTERN.test(id), `Escenario ${index + 1} tiene id invalido.`);
  assert(KNOWN_ROLES.has(role), `${id}: role desconocido "${role}".`);
  assert(description.length >= 20, `${id}: description debe explicar el alcance del smoke.`);
  assert(ENV_NAME_PATTERN.test(emailEnv), `${id}: emailEnv debe usar FRONTEND_AUTH_SMOKE_*_EMAIL.`);
  assert(ENV_NAME_PATTERN.test(passwordEnv), `${id}: passwordEnv debe usar FRONTEND_AUTH_SMOKE_*_PASSWORD.`);
  assert(emailEnv !== passwordEnv, `${id}: emailEnv y passwordEnv no pueden ser iguales.`);
  assert(!Object.hasOwn(value, "email"), `${id}: el manifiesto no debe contener correos reales.`);
  assert(!Object.hasOwn(value, "password"), `${id}: el manifiesto no debe contener passwords.`);
  assert(!Object.hasOwn(value, "token"), `${id}: el manifiesto no debe contener tokens.`);

  return {
    id,
    role,
    description,
    emailEnv,
    passwordEnv,
    targetPath,
    expectedPath,
    expectedHeading,
    requireModuleAccess
  };
}

async function readManifest() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const parsed = JSON.parse(raw);
  assert(parsed && typeof parsed === "object" && !Array.isArray(parsed), "Manifiesto de smoke invalido.");
  assert(parsed.version === 1, "Manifiesto de smoke debe declarar version 1.");
  assert(Array.isArray(parsed.scenarios), "Manifiesto de smoke debe declarar scenarios[].");
  assert(parsed.scenarios.length > 0, "Manifiesto de smoke debe declarar al menos un escenario.");

  const scenarios = parsed.scenarios.map(validateScenario);
  const ids = new Set();
  for (const scenario of scenarios) {
    assert(!ids.has(scenario.id), `Escenario duplicado: ${scenario.id}.`);
    ids.add(scenario.id);
  }

  return scenarios;
}

function hasPublicSupabaseConfig() {
  const env = readPublicSupabaseConfig();
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

function readPublicSupabaseConfig() {
  const viteEnv = loadEnv("development", process.cwd(), "");

  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL?.trim() || viteEnv.VITE_SUPABASE_URL?.trim() || "",
    supabaseAnonKey:
      process.env.VITE_SUPABASE_ANON_KEY?.trim() || viteEnv.VITE_SUPABASE_ANON_KEY?.trim() || ""
  };
}

function runScenario(scenario) {
  const email = process.env[scenario.emailEnv]?.trim() ?? "";
  const password = process.env[scenario.passwordEnv] ?? "";
  const publicConfig = readPublicSupabaseConfig();
  const missing = [
    !email ? scenario.emailEnv : null,
    !password ? scenario.passwordEnv : null,
    !publicConfig.supabaseUrl ? "VITE_SUPABASE_URL" : null,
    !publicConfig.supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      id: scenario.id,
      role: scenario.role,
      status: "skipped",
      reason: "missing_secure_smoke_credentials_or_public_supabase_config",
      missing
    };
  }

  const childEnv = {
    ...process.env,
    FRONTEND_AUTH_SMOKE_EMAIL: email,
    FRONTEND_AUTH_SMOKE_PASSWORD: password,
    FRONTEND_AUTH_SMOKE_REQUIRED: "1",
    FRONTEND_AUTH_SMOKE_REQUIRE_MODULE_ACCESS: scenario.requireModuleAccess ? "1" : "0",
    FRONTEND_AUTH_SMOKE_PATH: scenario.targetPath,
    FRONTEND_AUTH_SMOKE_EXPECTED_PATH: scenario.expectedPath,
    FRONTEND_AUTH_SMOKE_EXPECTED_HEADING: scenario.expectedHeading,
    VITE_SUPABASE_URL: publicConfig.supabaseUrl,
    VITE_SUPABASE_ANON_KEY: publicConfig.supabaseAnonKey
  };

  const result = spawnSync(process.execPath, ["scripts/smoke-frontend-authenticated.mjs"], {
    env: childEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    return {
      id: scenario.id,
      role: scenario.role,
      status: "failed",
      error: result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`
    };
  }

  return {
    id: scenario.id,
    role: scenario.role,
    status: "passed",
    output: JSON.parse(result.stdout)
  };
}

async function main() {
  const scenarios = await readManifest();
  const requireAll = process.env.FRONTEND_AUTH_SMOKE_MATRIX_REQUIRED === "1";
  const results = scenarios.map(runScenario);
  const failed = results.filter((item) => item.status === "failed");
  const skipped = results.filter((item) => item.status === "skipped");

  if (failed.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          smoke: "frontend-authenticated-matrix",
          manifest: MANIFEST_PATH,
          results
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (requireAll && skipped.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          smoke: "frontend-authenticated-matrix",
          manifest: MANIFEST_PATH,
          reason: "required_matrix_has_skipped_scenarios",
          results
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        smoke: "frontend-authenticated-matrix",
        manifest: MANIFEST_PATH,
        public_supabase_configured: hasPublicSupabaseConfig(),
        scenario_count: scenarios.length,
        passed_count: results.filter((item) => item.status === "passed").length,
        skipped_count: skipped.length,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
