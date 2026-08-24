#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { certificationState, isCertificationPassingState } from "./eees-governance-lib.mjs";

const file = path.join(process.cwd(), ".eees/evidence/certification.json");
const evidenceFile = path.join(process.cwd(), ".eees/evidence/latest.json");
if (!fs.existsSync(file) || !fs.existsSync(evidenceFile)) {
  console.error("EEES certification state: STALE (no existe evidencia local para HEAD)");
  process.exit(1);
}
const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
const gateEvidenceContents = fs.readFileSync(evidenceFile, "utf8");
const gateEvidence = JSON.parse(gateEvidenceContents);
const evidenceSha256 = crypto.createHash("sha256").update(gateEvidenceContents).digest("hex");
const sbomFile = path.join(process.cwd(), ".eees/evidence/sbom.cdx.json");
const sbomSha256 = fs.existsSync(sbomFile)
  ? crypto.createHash("sha256").update(fs.readFileSync(sbomFile)).digest("hex")
  : null;
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const workspaceDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const evidenceConsistent = evidence.evidenceSha256 === evidenceSha256
  && gateEvidence.commit === evidence.commit
  && gateEvidence.generatedAt === evidence.generatedAt
  && gateEvidence.artifactHashes?.sbomSha256 === sbomSha256
  && gateEvidence.gates?.every((gate) => gate.result === "PASS");
const state = evidence.standardVersion === "2.0.0" && !workspaceDirty && evidenceConsistent
  ? certificationState({
      errors: evidence.errors ?? 1,
      unresolvedWarnings: 0,
      acceptedRisks: evidence.acceptedRisks ?? 0,
      evidenceCommit: evidence.commit,
      currentCommit,
      generatedAt: evidence.generatedAt
    })
  : "STALE";

console.log(`EEES certification state: ${state}`);
if (!isCertificationPassingState(state)) process.exit(1);
