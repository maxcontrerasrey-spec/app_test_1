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
  const mappedRuleIds = new Set();
  for (const gate of document.gates ?? []) {
    if (!gate.id || gateIds.has(gate.id)) findings.push({ level: "ERROR", message: `Gate duplicado o sin ID: ${gate.id ?? "<vacio>"}` });
    gateIds.add(gate.id);
    if (gate.kind === "certifier") {
      if (gate.executable || gate.args || gate.command) findings.push({ level: "ERROR", message: `Gate ${gate.id} certifier no debe ejecutar comandos` });
    } else {
      if (gate.executable !== "npm" || !Array.isArray(gate.args) || gate.args[0] !== "run") {
        findings.push({ level: "ERROR", message: `Gate ${gate.id} sin executable/args npm auditables` });
      }
    }
    for (const ruleId of gate.rules ?? []) {
      if (!ruleIds.has(ruleId)) findings.push({ level: "ERROR", ruleId, message: `Gate ${gate.id} referencia regla inexistente` });
      mappedRuleIds.add(ruleId);
    }
  }
  for (const rule of rules) {
    const active = (rule.status ?? "active") === "active";
    if (rule.classification && active && rule.automatable && rule.blocking && !mappedRuleIds.has(rule.id)) {
      findings.push({ level: "ERROR", ruleId: rule.id, message: "Regla automatizable y bloqueante sin gate" });
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

export function validateSuppressions(document, now = new Date(), rules = []) {
  const findings = [];
  const required = ["id", "rule_id", "scope", "owner", "reason", "risk", "created_at", "expires_at", "exit_criteria"];
  const ids = new Set();
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  for (const suppression of document.suppressions ?? []) {
    for (const key of required) {
      if (!suppression[key]) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: `Supresion sin ${key}` });
    }
    if (ids.has(suppression.id)) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: `Supresion duplicada ${suppression.id}` });
    ids.add(suppression.id);
    if (rules.length > 0 && !ruleById.has(suppression.rule_id)) {
      findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "Supresion referencia regla inexistente" });
    } else if (ruleById.get(suppression.rule_id)?.status === "not_applicable") {
      findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "No se puede suprimir una regla no aplicable" });
    }
    const created = new Date(`${suppression.created_at}T00:00:00Z`);
    const expiry = new Date(`${suppression.expires_at}T23:59:59Z`);
    if (Number.isNaN(created.valueOf())) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "created_at invalido" });
    if (Number.isNaN(expiry.valueOf())) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "expires_at invalido" });
    else if (expiry < now) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: `Supresion expirada ${suppression.expires_at}` });
    else if (!Number.isNaN(created.valueOf()) && created > expiry) findings.push({ level: "ERROR", ruleId: suppression.rule_id, message: "created_at posterior a expires_at" });
  }
  return findings;
}

export function certificationState({ errors, warnings = 0, unresolvedWarnings = warnings, acceptedRisks = 0, evidenceCommit, currentCommit, generatedAt, maxAgeHours = 24 }) {
  if (errors > 0 || unresolvedWarnings > 0) return "NOT_CERTIFIED";
  const age = Date.now() - new Date(generatedAt).valueOf();
  if (!evidenceCommit || evidenceCommit !== currentCommit || !Number.isFinite(age) || age > maxAgeHours * 3_600_000) return "STALE";
  return acceptedRisks > 0 ? "CERTIFIED_WITH_ACCEPTED_RISK" : "CERTIFIED";
}

export function isCertificationPassingState(state) {
  return state === "CERTIFIED" || state === "CERTIFIED_WITH_ACCEPTED_RISK";
}
