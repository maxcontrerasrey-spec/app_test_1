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
    requireModuleAccess: process.env.FRONTEND_AUTH_SMOKE_REQUIRE_MODULE_ACCESS === "1",
    targetPath: process.env.FRONTEND_AUTH_SMOKE_PATH?.trim() || "/",
    expectedPath: process.env.FRONTEND_AUTH_SMOKE_EXPECTED_PATH?.trim() || "",
    expectedHeading: process.env.FRONTEND_AUTH_SMOKE_EXPECTED_HEADING?.trim() || "",
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function assertNexusHomeLayout(page) {
  await page.locator('img[alt="Logo Nexus"]').waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  const infoCards = page.locator(".dashboard-info-row > .dashboard-info-card");
  await infoCards.first().waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  assert((await infoCards.count()) === 3, "Dashboard must render exactly three informative widgets.");
  const tasksZone = page.locator(".dashboard-zone-tasks");
  const requestsZone = page.locator(".dashboard-zone-approvals");
  await tasksZone.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  await requestsZone.waitFor({ timeout: DEFAULT_TIMEOUT_MS });

  const queueGeometry = await page.evaluate(() => {
    const tasks = document.querySelector(".dashboard-zone-tasks")?.getBoundingClientRect();
    const requests = document.querySelector(".dashboard-zone-approvals")?.getBoundingClientRect();
    if (!tasks || !requests) return null;
    return {
      tasks: { left: tasks.left, right: tasks.right, bottom: tasks.bottom, width: tasks.width },
      requests: { left: requests.left, right: requests.right, top: requests.top, width: requests.width }
    };
  });

  assert(queueGeometry, "Dashboard queue geometry is unavailable.");
  assert(
    queueGeometry.requests.top >= queueGeometry.tasks.bottom,
    "Request tracking must render below pending tasks."
  );
  assert(
    Math.abs(queueGeometry.tasks.left - queueGeometry.requests.left) <= 2 &&
      Math.abs(queueGeometry.tasks.width - queueGeometry.requests.width) <= 2,
    "Pending tasks and request tracking must use the same full-width axis."
  );
  assert(
    (await requestsZone.getByRole("textbox").count()) === 0,
    "Request tracking must render its table without a local search field."
  );

  const sidebarToggle = page.getByRole("button", { name: /Ocultar barra lateral|Mostrar barra lateral/ });
  await sidebarToggle.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  if ((await sidebarToggle.getAttribute("aria-expanded")) !== "true") {
    await sidebarToggle.click();
  }

  const expandedGeometry = await page.locator("main.main-content").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.getByRole("button", { name: "Ocultar barra lateral" }).click();
  await page.locator(".app-shell-sidebar-collapsed").waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  await page.waitForFunction(
    ({ expandedLeft, expandedWidth }) => {
      const main = document.querySelector("main.main-content");
      if (!main) return false;
      const rect = main.getBoundingClientRect();
      return rect.left < expandedLeft - 100 && rect.width > expandedWidth + 100;
    },
    { expandedLeft: expandedGeometry.left, expandedWidth: expandedGeometry.width },
    { timeout: DEFAULT_TIMEOUT_MS }
  );
  const collapsedGeometry = await page.locator("main.main-content").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });

  assert(
    collapsedGeometry.left < expandedGeometry.left - 100 &&
      collapsedGeometry.width > expandedGeometry.width + 100,
    "Collapsing the sidebar must materially increase the usable workspace width."
  );

  const compactRail = page.getByRole("navigation", { name: "Navegación compacta" });
  await compactRail.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  const compactRailGeometry = await compactRail.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const links = Array.from(element.querySelectorAll("a"));
    const groups = Array.from(element.querySelectorAll(".sidebar-icon-rail-group"));
    return {
      width: rect.width,
      height: rect.height,
      linkCount: links.length,
      groupCount: groups.length,
      buttonCount: element.querySelectorAll("button").length,
      allLinksNamed: links.every((link) => Boolean(link.getAttribute("aria-label"))),
      allGroupsSeparated: groups.every((group) => getComputedStyle(group).borderTopWidth === "1px")
    };
  });
  assert(
    compactRailGeometry.width <= 54 && compactRailGeometry.height > 0,
    "Collapsed icon rail must stay inside the existing narrow gutter."
  );
  const collapsedContentGap = await page.evaluate(() => {
    const rail = document.querySelector(".sidebar-icon-rail");
    const content = document.querySelector(".dashboard-container");
    if (!rail || !content) return null;
    return content.getBoundingClientRect().left - rail.getBoundingClientRect().right;
  });
  assert(
    collapsedContentGap !== null && collapsedContentGap >= 10 && collapsedContentGap <= 14,
    "Collapsed workspace content must keep a subtle 12px gap after the icon rail."
  );
  assert(
    compactRailGeometry.linkCount >= 2 && compactRailGeometry.groupCount >= 1,
    "Collapsed icon rail must expose authorized submodule destinations grouped by module."
  );
  assert(
    compactRailGeometry.buttonCount === 0 && compactRailGeometry.allGroupsSeparated,
    "Collapsed icon rail must omit module controls while preserving group separators."
  );
  assert(
    compactRailGeometry.allLinksNamed,
    "Every compact submodule icon must keep an accessible name."
  );
  await page.getByRole("button", { name: "Mostrar barra lateral" }).click();

  const foliosTable = page.locator(".dashboard-folios-table");
  await foliosTable.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  const foliosLayout = await readRecruitmentTableLayout(foliosTable);
  assertRecruitmentTableLayout(foliosLayout, "Dashboard active folios");
}

async function assertHiringProcessesLayout(page) {
  const table = page.locator(".hiring-processes-table");
  await table.waitFor({ timeout: DEFAULT_TIMEOUT_MS });

  const layout = await readRecruitmentTableLayout(table);
  assertRecruitmentTableLayout(layout, "Hiring processes");
}

async function readRecruitmentTableLayout(table) {
  return table.evaluate((element) => {
    const caseCode = element.querySelector(".case-code-toggle");
    const candidateIndicator = element.querySelector(".candidate-count-indicator");
    const headings = Array.from(element.querySelectorAll("thead th"), (heading) =>
      heading.textContent?.replace(/[↕↑↓]/g, "").trim() ?? ""
    );
    const contractValues = Array.from(element.querySelectorAll("tbody tr:not(.tracking-table-expanded-row) td:nth-child(4)"), (cell) =>
      cell.textContent?.trim() ?? ""
    );

    return {
      tableLayout: window.getComputedStyle(element).tableLayout,
      caseWhiteSpace: caseCode ? window.getComputedStyle(caseCode).whiteSpace : null,
      indicatorWhiteSpace: candidateIndicator
        ? window.getComputedStyle(candidateIndicator).whiteSpace
        : null,
      indicatorHeight: candidateIndicator?.getBoundingClientRect().height ?? null,
      headings,
      contractValues
    };
  });
}

function assertRecruitmentTableLayout(layout, label) {
  assert(layout.tableLayout === "auto", "Hiring processes table must use automatic column sizing.");
  assert(layout.headings.includes("Abierto"), `${label} must use the compact Abierto heading.`);
  assert(!layout.headings.includes("Días Abierto"), `${label} must not render Días Abierto.`);
  assert(
    layout.contractValues.every((value) => !/\(\d+\)$/.test(value)),
    `${label} must omit trailing numeric contract codes.`
  );
  if (layout.caseWhiteSpace !== null) {
    assert(layout.caseWhiteSpace === "nowrap", `${label} case codes must remain on one line.`);
  }
  if (layout.indicatorWhiteSpace !== null) {
    assert(
      layout.indicatorWhiteSpace === "nowrap" && layout.indicatorHeight <= 28,
      `${label} candidate counters and labels must remain on one compact line.`
    );
  }
}

async function assertHiringRequestLayout(page) {
  const form = page.locator(".hiring-main-column");
  const summary = page.locator(".hiring-request-summary-card");
  await form.waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  await summary.waitFor({ timeout: DEFAULT_TIMEOUT_MS });

  const geometry = await page.evaluate(() => {
    const formRect = document.querySelector(".hiring-main-column")?.getBoundingClientRect();
    const summaryRect = document.querySelector(".hiring-request-summary-card")?.getBoundingClientRect();
    if (!formRect || !summaryRect) return null;
    return {
      form: { left: formRect.left, right: formRect.right, bottom: formRect.bottom },
      summary: { left: summaryRect.left, right: summaryRect.right, top: summaryRect.top }
    };
  });

  assert(geometry, "Hiring request form geometry is unavailable.");
  assert(geometry.summary.top >= geometry.form.bottom, "Hiring request summary must render below the form.");
  assert(
    Math.abs(geometry.summary.left - geometry.form.left) <= 2 &&
      Math.abs(geometry.summary.right - geometry.form.right) <= 2,
    "Hiring request form and summary must share the full horizontal axis."
  );
}

async function assertNexusLayoutContracts(page, currentPath) {
  if (currentPath === "/") {
    await assertNexusHomeLayout(page);
  }
  if (currentPath === "/control-contrataciones") {
    await assertHiringProcessesLayout(page);
  }
  if (currentPath === "/solicitud-contrataciones") {
    await assertHiringRequestLayout(page);
  }
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
    assert(
      !config.requireModuleAccess,
      `Authenticated smoke reached /sin-acceso for ${targetPath}, but FRONTEND_AUTH_SMOKE_REQUIRE_MODULE_ACCESS=1.`
    );

    await page.getByRole("heading", { name: "Sin acceso" }).waitFor({ timeout: DEFAULT_TIMEOUT_MS });
    return {
      target_result: "authenticated_but_without_module_access",
      final_path: currentPath
    };
  }

  const expectedPath = config.expectedPath ? normalizePath(config.expectedPath) : "";
  assert(
    !expectedPath || currentPath === expectedPath,
    `Authenticated smoke expected final path ${expectedPath}, got ${currentPath}.`
  );

  if (config.expectedHeading) {
    await page
      .getByRole("heading", { name: new RegExp(escapeRegExp(config.expectedHeading), "i") })
      .waitFor({ timeout: DEFAULT_TIMEOUT_MS });
  }

  await page.waitForLoadState("domcontentloaded", { timeout: DEFAULT_TIMEOUT_MS });
  await assertNexusLayoutContracts(page, currentPath);
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
          expected_path: config.expectedPath ? normalizePath(config.expectedPath) : null,
          expected_heading: config.expectedHeading || null,
          require_module_access: config.requireModuleAccess,
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
