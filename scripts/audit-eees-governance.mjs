#!/usr/bin/env node

import path from "node:path";
import { readJson, validateDocumentedRules, validateGates, validateRegistry, validateSuppressions } from "./eees-governance-lib.mjs";

const root = process.cwd();
const rules = readJson(path.join(root, "eees/guardian/rules.json"));
const findings = [
  ...validateRegistry(rules, root),
  ...validateDocumentedRules(rules, path.join(root, "eees/books")),
  ...validateGates(readJson(path.join(root, "eees/guardian/gates.json")), rules),
  ...validateSuppressions(readJson(path.join(root, "eees/guardian/suppressions.json")), new Date(), rules)
];

if (findings.length) {
  console.error("EEES governance audit failed:");
  for (const finding of findings) console.error(`- ${finding.ruleId ?? "GOV"}: ${finding.message}`);
  process.exit(1);
}

console.log("EEES governance audit passed: registry unico, IDs unicos, fuentes existentes y excepciones vigentes.");
