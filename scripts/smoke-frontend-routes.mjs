import { chromium } from "playwright";
import { createServer } from "vite";

const DEFAULT_TIMEOUT_MS = 15_000;
const HOST = "127.0.0.1";
const SMOKE_SUPABASE_URL = "http://127.0.0.1:54321";
const SMOKE_SUPABASE_ANON_KEY = "frontend-route-smoke-anon-key";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createLocalServer() {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || SMOKE_SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY =
    process.env.VITE_SUPABASE_ANON_KEY || SMOKE_SUPABASE_ANON_KEY;

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
    throw new Error("Vite did not expose a local server port for frontend smoke.");
  }

  return {
    baseUrl: `http://${HOST}:${address.port}`,
    close: () => server.close()
  };
}

async function resolveServer() {
  const configuredBaseUrl = process.env.FRONTEND_SMOKE_BASE_URL?.trim().replace(/\/$/, "");

  if (configuredBaseUrl) {
    return {
      baseUrl: configuredBaseUrl,
      close: async () => undefined
    };
  }

  return createLocalServer();
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No fue posible abrir Chromium para el smoke frontend. Ejecuta "npx playwright install chromium" si el navegador no esta instalado. Detalle: ${message}`
    );
  }
}

async function assertLoginPage(page, baseUrl) {
  await page.goto(`${baseUrl}/login`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS
  });

  await page
    .getByRole("heading", { name: "Iniciar sesión" })
    .waitFor({ timeout: DEFAULT_TIMEOUT_MS });

  await expectVisible(page.locator("#login-email"), "login email input");
  await expectVisible(page.locator("#login-password"), "login password input");
  await expectVisible(page.getByRole("button", { name: "Continuar" }), "login submit button");
  await expectVisible(
    page.getByRole("button", { name: /recuperar acceso/i }),
    "password recovery action"
  );
}

async function assertProtectedRouteRedirects(page, baseUrl) {
  await page.goto(`${baseUrl}/operaciones/resumen`, {
    waitUntil: "domcontentloaded",
    timeout: DEFAULT_TIMEOUT_MS
  });

  await page.waitForURL(/\/login$/, {
    timeout: DEFAULT_TIMEOUT_MS
  });

  await page
    .getByRole("heading", { name: "Iniciar sesión" })
    .waitFor({ timeout: DEFAULT_TIMEOUT_MS });
}

async function expectVisible(locator, label) {
  await locator.waitFor({
    state: "visible",
    timeout: DEFAULT_TIMEOUT_MS
  });
}

async function main() {
  const server = await resolveServer();
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
    await assertLoginPage(page, server.baseUrl);
    await assertProtectedRouteRedirects(page, server.baseUrl);

    assert(pageErrors.length === 0, `Frontend smoke captured page errors: ${pageErrors.join(" | ")}`);

    console.log(
      JSON.stringify(
        {
          ok: true,
          smoke: "frontend-routes",
          browser: "chromium",
          base_url: server.baseUrl,
          checked_routes: ["/login", "/operaciones/resumen"],
          protected_route_result: "/operaciones/resumen redirected to /login without session"
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
