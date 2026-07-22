import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const baselinePath = "eees/baselines/PERFORMANCE_BASELINE_v1.md";
const marker = "<!-- EEES_PERFORMANCE_BASELINE_JSON -->";
const checks = [];

function addCheck(ok, message) {
  checks.push({ ok, message });
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
  addCheck(
    Number.isFinite(baseline.distTotalBytes) && metrics.totalBytes <= baseline.distTotalBytes,
    `dist total ${metrics.totalBytes} <= baseline ${baseline.distTotalBytes}`
  );
  addCheck(
    Number.isFinite(baseline.jsTotalBytes) && metrics.jsBytes <= baseline.jsTotalBytes,
    `JS total ${metrics.jsBytes} <= baseline ${baseline.jsTotalBytes}`
  );
  addCheck(
    Number.isFinite(baseline.cssTotalBytes) && metrics.cssBytes <= baseline.cssTotalBytes,
    `CSS total ${metrics.cssBytes} <= baseline ${baseline.cssTotalBytes}`
  );

  for (const asset of baseline.trackedAssets ?? []) {
    const current = findAsset(metrics, asset.match);
    addCheck(Boolean(current), `asset trackeado ${asset.match} existe en dist`);
    if (current) {
      addCheck(
        current.bytes <= asset.maxBytes,
        `${asset.match} ${current.bytes} <= baseline ${asset.maxBytes}`
      );
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
