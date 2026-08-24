import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const baselinePath = "eees/baselines/PERFORMANCE_BASELINE_v1.md";
const marker = "<!-- EEES_PERFORMANCE_BASELINE_JSON -->";
const checks = [];
const warnings = [];

const DEFAULT_WARNING_PERCENT = 1;
const DEFAULT_ERROR_PERCENT = 3;
const DEFAULT_ABSOLUTE_TOLERANCE_BYTES = 16 * 1024;

function addCheck(ok, message) {
  checks.push({ ok, message });
}

function evaluateBudget(label, current, baselineValue, policy = {}) {
  if (!Number.isFinite(baselineValue) || baselineValue < 0) {
    addCheck(false, `${label} no tiene baseline numerico valido`);
    return;
  }

  const absoluteTolerance = policy.absoluteToleranceBytes ?? DEFAULT_ABSOLUTE_TOLERANCE_BYTES;
  const warningPercent = policy.warningPercent ?? DEFAULT_WARNING_PERCENT;
  const errorPercent = policy.errorPercent ?? DEFAULT_ERROR_PERCENT;
  const delta = current - baselineValue;
  const percent = baselineValue === 0 ? (delta > 0 ? Infinity : 0) : (delta / baselineValue) * 100;
  const errorLimit = Math.max(absoluteTolerance, baselineValue * (errorPercent / 100));
  const warningLimit = Math.max(absoluteTolerance / 2, baselineValue * (warningPercent / 100));

  if (delta > errorLimit) {
    addCheck(false, `${label} aumento ${delta} bytes (${percent.toFixed(2)}%), sobre presupuesto ${errorPercent}%`);
    return;
  }
  addCheck(true, `${label} ${current} bytes; baseline ${baselineValue}; delta ${delta}`);
  if (delta > warningLimit) {
    warnings.push(`${label} aumento ${delta} bytes (${percent.toFixed(2)}%); revisar antes de agotar el presupuesto`);
  }
}

function listFiles(dir) {
  const base = path.join(repoRoot, dir);
  if (!fs.existsSync(base)) {
    return [];
  }

  const result = [];
  const stack = [base];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        const relativePath = path.relative(repoRoot, fullPath);
        result.push({
          path: relativePath,
          bytes: fs.statSync(fullPath).size
        });
      }
    }
  }

  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function readBaseline() {
  addCheck(fs.existsSync(path.join(repoRoot, baselinePath)), `${baselinePath} existe`);
  if (!fs.existsSync(path.join(repoRoot, baselinePath))) {
    return null;
  }

  const content = fs.readFileSync(path.join(repoRoot, baselinePath), "utf8");
  const markerIndex = content.indexOf(marker);
  const jsonBlock = markerIndex === -1 ? null : content.slice(markerIndex).match(/```json\n([\s\S]*?)\n```/);
  addCheck(Boolean(jsonBlock), `${baselinePath} contiene bloque JSON machine-readable`);
  if (!jsonBlock) {
    return null;
  }

  try {
    return JSON.parse(jsonBlock[1]);
  } catch (error) {
    addCheck(false, `${baselinePath} contiene JSON invalido: ${error.message}`);
    return null;
  }
}

function collectCurrentMetrics() {
  const files = listFiles("dist");
  const jsFiles = files.filter((file) => file.path.endsWith(".js"));
  const cssFiles = files.filter((file) => file.path.endsWith(".css"));
  const totalBytes = files.reduce((total, file) => total + file.bytes, 0);
  const jsBytes = jsFiles.reduce((total, file) => total + file.bytes, 0);
  const cssBytes = cssFiles.reduce((total, file) => total + file.bytes, 0);

  return {
    totalBytes,
    jsFileCount: jsFiles.length,
    jsBytes,
    cssFileCount: cssFiles.length,
    cssBytes,
    assets: files
  };
}

function findAsset(metrics, match) {
  return metrics.assets.find((asset) => asset.path.includes(match));
}

const baseline = readBaseline();
const metrics = collectCurrentMetrics();
addCheck(metrics.assets.length > 0, "dist contiene artefactos de build medibles");

if (baseline) {
  const policy = baseline.budgetPolicy ?? {};
  evaluateBudget("dist total", metrics.totalBytes, baseline.distTotalBytes, policy);
  evaluateBudget("JS total", metrics.jsBytes, baseline.jsTotalBytes, policy);
  evaluateBudget("CSS total", metrics.cssBytes, baseline.cssTotalBytes, policy);

  for (const asset of baseline.trackedAssets ?? []) {
    const current = findAsset(metrics, asset.match);
    addCheck(Boolean(current), `asset trackeado ${asset.match} existe en dist`);
    if (current) {
      evaluateBudget(asset.match, current.bytes, asset.maxBytes, {
        ...policy,
        ...asset.budgetPolicy
      });
    }
  }
}

const failedChecks = checks.filter((check) => !check.ok);
if (failedChecks.length > 0) {
  console.error("Performance baseline audit failed:");
  for (const check of failedChecks) {
    console.error(`- ${check.message}`);
  }
  process.exit(1);
}

console.log("Performance baseline audit passed:");
for (const warning of warnings) {
  console.warn(`Performance budget warning: ${warning}`);
}
console.log(
  JSON.stringify(
    {
      distTotalBytes: metrics.totalBytes,
      jsFileCount: metrics.jsFileCount,
      jsTotalBytes: metrics.jsBytes,
      cssFileCount: metrics.cssFileCount,
      cssTotalBytes: metrics.cssBytes,
      checks: checks.map((check) => check.message)
    },
    null,
    2
  )
);
