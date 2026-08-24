import fs from "node:fs";
import path from "node:path";

export const RULE_ID_PATTERN = /^(AI|API|ARCH|BE|CICD|CONC|DATA|DB|DOC|ENG|ERR|FE|GOV|INT|MOD|OBS|PERF|QA|REL|RES|SEC|SUP|TST|UX)-\d{3}$/;
export const RULE_CLASSIFICATIONS = new Set(["preventive", "detective", "governance", "evidence"]);
export const RULE_STATUSES = new Set(["active", "deprecated", "not_applicable"]);

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function validateRegistry(rules, root = process.cwd()) {
  const findings = [];
  const ids = new Set();
  if (!Array.isArray(rules)) return [{ level: "ERROR", message: "rules.json debe ser un array" }];

  for (const rule of rules) {
    for (const key of ["id", "title", "severity", "scope", "source_document", "automatable", "blocking"]) {
      if (!(key in rule)) findings.push({ level: "ERROR", ruleId: rule.id, message: `Falta ${key}` });
    }
    if (!RULE_ID_PATTERN.test(rule.id ?? "")) findings.push({ level: "ERROR", ruleId: rule.id, message: "ID invalido" });
    if (ids.has(rule.id)) findings.push({ level: "ERROR", ruleId: rule.id, message: "ID duplicado" });
    ids.add(rule.id);
    if (!fs.existsSync(path.join(root, rule.source_document ?? ""))) {
      findings.push({ level: "ERROR", ruleId: rule.id, message: `Fuente inexistente: ${rule.source_document}` });
    } else if (!fs.readFileSync(path.join(root, rule.source_document), "utf8").includes(rule.id)) {
      findings.push({ level: "ERROR", ruleId: rule.id, message: `Regla activa no documentada en ${rule.source_document}` });
    }
    if (rule.classification && !RULE_CLASSIFICATIONS.has(rule.classification)) {
      findings.push({ level: "ERROR", ruleId: rule.id, message: `classification invalida: ${rule.classification}` });
    }
    if (rule.status && !RULE_STATUSES.has(rule.status)) {
      findings.push({ level: "ERROR", ruleId: rule.id, message: `status invalido: ${rule.status}` });
    }
  }
  return findings;
}

export function validateGates(document, rules) {
  const findings = [];
  const ruleIds = new Set(rules.map((rule) => rule.id));
  const gateIds = new Set();
  for (const gate of document.gates ?? []) {
    if (!gate.id || gateIds.has(gate.id)) findings.push({ level: "ERROR", message: `Gate duplicado o sin ID: ${gate.id ?? "<vacio>"}` });
    gateIds.add(gate.id);
    if (!gate.command?.startsWith("npm run ")) findings.push({ level: "ERROR", message: `Gate ${gate.id} sin comando npm auditable` });
    for (const ruleId of gate.rules ?? []) {
      if (!ruleIds.has(ruleId)) findings.push({ level: "ERROR", ruleId, message: `Gate ${gate.id} referencia regla inexistente` });
    }
  }
  return findings;
}

export function validateDocumentedRules(rules, booksRoot) {
  const findings = [];
  const ruleIds = new Set(rules.map((rule) => rule.id));
  for (const entry of fs.readdirSync(booksRoot).filter((file) => file.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(booksRoot, entry), "utf8");
    for (const match of content.matchAll(/^##\s+([A-Z]+-\d{3})\b/gm)) {
      if (!ruleIds.has(match[1])) findings.push({ level: "ERROR", ruleId: match[1], message: `Regla documentada no registrada en ${entry}` });
    }
  }
  return findings;
}

export function validateSuppressions(document, now = new Date()) {
  const findings = [];
  const required = ["id", "rule_id", "scope", "owner", "reason", "risk", "created_at", "expires_at", "exit_criteria"];
  for (const suppression of document.suppressions ?? []) {
    for (const key of required) {
      if (!suppression[key]) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: `Supresion sin ${key}` });
    }
    const expiry = new Date(`${suppression.expires_at}T23:59:59Z`);
    if (Number.isNaN(expiry.valueOf())) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "expires_at invalido" });
    else if (expiry < now) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: `Supresion expirada ${suppression.expires_at}` });
  }
  return findings;
}

export function certificationState({ errors, warnings, evidenceCommit, currentCommit, generatedAt, maxAgeHours = 24 }) {
  if (errors > 0) return "NOT_CERTIFIED";
  const age = Date.now() - new Date(generatedAt).valueOf();
  if (!evidenceCommit || evidenceCommit !== currentCommit || !Number.isFinite(age) || age > maxAgeHours * 3_600_000) return "STALE";
  return warnings > 0 ? "CERTIFIED_WITH_ACCEPTED_RISK" : "CERTIFIED";
}
