import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const checks = [];

function readFile(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeBaseRoute(routePath) {
  if (routePath === "/") {
    return "/";
  }

  return routePath
    .replace(/\/:\w+\??/g, "")
    .replace(/\/\*$/, "")
    .replace(/\/$/, "") || "/";
}

function extractStringUnion(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName} =([\\s\\S]*?);`));

  if (!match) {
    return [];
  }

  return unique(Array.from(match[1].matchAll(/"([^"]+)"/g)).map((valueMatch) => valueMatch[1]));
}

const accessSource = readFile("src/modules/auth/config/access.ts");
const appRouterSource = readFile("src/app/router/AppRouter.tsx");
const navigationSource = readFile("src/shared/config/navigation.ts");
const routeModulesSource = readFile("src/app/router/routeModules.ts");

const knownModuleCodes = extractStringUnion(accessSource, "AppModuleCode");
const knownRoles = extractStringUnion(accessSource, "AppRole");

addCheck(knownModuleCodes.length > 0, "access.ts declara AppModuleCode");
addCheck(knownRoles.length > 0, "access.ts declara AppRole");

const routePathMatches = Array.from(appRouterSource.matchAll(/<Route\s+path="([^"]+)"/g));
const roleProtectedRoutes = [];

for (let index = 0; index < routePathMatches.length; index += 1) {
  const match = routePathMatches[index];
  const nextMatch = routePathMatches[index + 1];
  const routeSegment = appRouterSource.slice(match.index, nextMatch?.index ?? appRouterSource.length);
  const moduleMatch = routeSegment.match(/<RoleProtectedRoute\s+moduleCode="([^"]+)"/);

  if (!moduleMatch) {
    continue;
  }

  roleProtectedRoutes.push({
    path: match[1],
    basePath: normalizeBaseRoute(match[1]),
    moduleCode: moduleMatch[1]
  });
}

for (const route of roleProtectedRoutes) {
  addCheck(
    knownModuleCodes.includes(route.moduleCode),
    `ruta ${route.path} usa modulo conocido ${route.moduleCode}`
  );
}

const navigationItems = Array.from(
  navigationSource.matchAll(/moduleCode:\s*"([^"]+)"[\s\S]{0,260}?to:\s*"([^"]+)"/g)
).map((match) => ({
  moduleCode: match[1],
  to: match[2],
  basePath: normalizeBaseRoute(match[2])
}));

for (const item of navigationItems) {
  addCheck(
    knownModuleCodes.includes(item.moduleCode),
    `navegacion ${item.to} usa modulo conocido ${item.moduleCode}`
  );

  const routeMatch = roleProtectedRoutes
    .filter((route) =>
      item.to === route.basePath ||
      item.to.startsWith(`${route.basePath}/`) ||
      route.basePath.startsWith(`${item.to}/`)
    )
    .sort((left, right) => right.basePath.length - left.basePath.length)[0];

  addCheck(Boolean(routeMatch), `navegacion ${item.to} tiene ruta protegida`);

  if (routeMatch) {
    addCheck(
      routeMatch.moduleCode === item.moduleCode,
      `navegacion ${item.to} coincide con guard ${routeMatch.moduleCode}`
    );
  }
}

const visibleRoleReferences = unique(
  Array.from(navigationSource.matchAll(/visibleForRoles:\s*\[([^\]]+)\]/g))
    .flatMap((match) => Array.from(match[1].matchAll(/"([^"]+)"/g)).map((roleMatch) => roleMatch[1]))
);

for (const role of visibleRoleReferences) {
  addCheck(knownRoles.includes(role), `visibleForRoles referencia rol conocido ${role}`);
}

const routeBasesToPreload = unique(
  [
    ...roleProtectedRoutes.map((route) => route.basePath),
    "/login",
    "/reset-password",
    "/sin-acceso",
    "/copiloto-ia"
  ].filter((value) => value !== "/")
).filter((basePath, _index, values) => {
  return !values.some(
    (otherPath) => otherPath !== basePath && basePath.startsWith(`${otherPath}/`)
  );
});

for (const basePath of routeBasesToPreload) {
  addCheck(
    routeModulesSource.includes(`normalizedPath.startsWith("${basePath}")`),
    `routeModules precarga ${basePath}`
  );
}

const failedChecks = checks.filter((check) => !check.ok);

if (failedChecks.length > 0) {
  console.error("Route role smoke audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Route role smoke audit passed:");
for (const check of checks) {
  console.log(`- ${check.message}`);
}
