import { chromium } from "playwright";
import { createServer, loadEnv } from "vite";

const DEFAULT_TIMEOUT_MS = 25_000;
const HOST = "127.0.0.1";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readEnv() {
  const viteEnv = loadEnv("development", process.cwd(), "");

  return {
    email: process.env.FRONTEND_AUTH_SMOKE_EMAIL?.trim() ?? "",
    password: process.env.FRONTEND_AUTH_SMOKE_PASSWORD ?? "",
    required: process.env.FRONTEND_AUTH_SMOKE_REQUIRED === "1",
    targetPath: process.env.FRONTEND_AUTH_SMOKE_PATH?.trim() || "/",
    baseUrl: process.env.FRONTEND_SMOKE_BASE_URL?.trim().replace(/\/$/, "") ?? "",
    supabaseUrl: process.env.VITE_SUPABASE_URL?.trim() || viteEnv.VITE_SUPABASE_URL?.trim() || "",
    supabaseAnonKey:
      process.env.VITE_SUPABASE_ANON_KEY?.trim() || viteEnv.VITE_SUPABASE_ANON_KEY?.trim() || ""
  };
}

function maskEmail(value) {
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain) {
    return "configured";
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function normalizePath(pathname) {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

async function createLocalServer(config) {
  process.env.VITE_SUPABASE_URL = config.supabaseUrl;
  process.env.VITE_SUPABASE_ANON_KEY = config.supabaseAnonKey;

  const server = await createServer({
    server: {
      host: HOST,
      port: 0,
      strictPort: false
    },
    logLevel: "error"
  });

  await server.listen();

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    await server.close();
    throw new Error("Vite did not expose a local server port for authenticated frontend smoke.");
  }

  return {
    baseUrl: `http://${HOST}:${address.port}`,
    close: () => server.close()
  };
}

async function resolveServer(config) {
  if (config.baseUrl) {
    return {
      baseUrl: config.baseUrl,
      close: async () => undefined
    };
  }

  return createLocalServer(config);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No fue posible abrir Chromium para el smoke autenticado. Ejecuta "npx playwright install chromium" si el navegador no esta instalado. Detalle: ${message}`
    );
  }
}

async function signIn(page, baseUrl, config) {
  await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS
  });

  await page.locator("#login-email").fill(config.email);
  await page.locator("#login-password").fill(config.password);
  await page.getByRole("button", { name: "Continuar" }).click();

  await Promise.race([
    page.getByRole("heading", { name: /Bienvenido/i }).waitFor({ timeout: DEFAULT_TIMEOUT_MS }),
    page.getByRole("heading", { name: /Selecciona quién está operando/i }).waitFor({
      timeout: DEFAULT_TIMEOUT_MS
    }),
    page.getByRole("heading", { name: /Restablecer contraseña/i }).waitFor({
      timeout: DEFAULT_TIMEOUT_MS
    }),
    page.getByRole("heading", { name: /Sin acceso/i }).waitFor({ timeout: DEFAULT_TIMEOUT_MS })
  ]);

  const loginError = await page.locator(".login-error").first().textContent().catch(() => null);
  assert(!loginError, "Authenticated smoke could not sign in with the provided test credentials.");
}

async function assertAuthenticatedState(page, baseUrl, config) {
  const forcedPasswordReset = await page
    .getByRole("heading", { name: /Restablecer contraseña/i })
    .isVisible()
    .catch(() => false);

  assert(
    !forcedPasswordReset,
    "Authenticated smoke account is forced to reset password; use a dedicated active smoke account."
  );

  const operatorGate = await page
    .getByRole("heading", { name: /Selecciona quién está operando/i })
    .isVisible()
    .catch(() => false);

  if (operatorGate) {
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.getByRole("heading", { name: /Bienvenido/i }).waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  }

  await page.getByRole("heading", { name: /Bienvenido/i }).waitFor({ timeout: DEFAULT_TIMEOUT_MS });

  const targetPath = normalizePath(config.targetPath);
  await page.goto(`${baseUrl}${targetPath}`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS
  });

  const currentPath = new URL(page.url()).pathname;
  assert(currentPath !== "/login", "Authenticated smoke was redirected back to login.");

  if (currentPath === "/sin-acceso") {
    await page.getByRole("heading", { name: "Sin acceso" }).waitFor({ timeout: DEFAULT_TIMEOUT_MS });
    return {
      target_result: "authenticated_but_without_module_access",
      final_path: currentPath
    };
  }

  await page.waitForLoadState("domcontentloaded", { timeout: DEFAULT_TIMEOUT_MS });
  return {
    target_result: "authenticated_route_loaded",
    final_path: currentPath
  };
}

async function main() {
  const config = readEnv();
  const missingCredential = !config.email || !config.password;
  const missingPublicSupabaseConfig = !config.supabaseUrl || !config.supabaseAnonKey;

  if (missingCredential || missingPublicSupabaseConfig) {
    const missing = [
      !config.email ? "FRONTEND_AUTH_SMOKE_EMAIL" : null,
      !config.password ? "FRONTEND_AUTH_SMOKE_PASSWORD" : null,
      !config.supabaseUrl ? "VITE_SUPABASE_URL" : null,
      !config.supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null
    ].filter(Boolean);

    if (config.required) {
      throw new Error(`Faltan variables para smoke autenticado: ${missing.join(", ")}.`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          smoke: "frontend-authenticated",
          status: "skipped",
          reason: "missing_secure_smoke_credentials_or_public_supabase_config",
          missing
        },
        null,
        2
      )
    );
    return;
  }

  const server = await resolveServer(config);
  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: {
      width: 1366,
      height: 768
    }
  });
  const pageErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  try {
    await signIn(page, server.baseUrl, config);
    const routeResult = await assertAuthenticatedState(page, server.baseUrl, config);

    assert(
      pageErrors.length === 0,
      `Authenticated frontend smoke captured page errors: ${pageErrors.join(" | ")}`
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          smoke: "frontend-authenticated",
          status: "passed",
          browser: "chromium",
          base_url: server.baseUrl,
          user: maskEmail(config.email),
          target_path: normalizePath(config.targetPath),
          ...routeResult
        },
        null,
        2
      )
    );
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
