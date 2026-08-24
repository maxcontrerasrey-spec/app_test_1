#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { certificationState } from "./eees-governance-lib.mjs";

const file = path.join(process.cwd(), ".eees/evidence/certification.json");
if (!fs.existsSync(file)) {
  console.error("EEES certification state: STALE (no existe evidencia local para HEAD)");
  process.exit(1);
}
const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const workspaceDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const state = evidence.standardVersion === "2.0.0" && !workspaceDirty
  ? certificationState({
      errors: evidence.errors ?? 1,
      warnings: evidence.warnings ?? 0,
      evidenceCommit: evidence.commit,
      currentCommit,
      generatedAt: evidence.generatedAt
    })
  : "STALE";

console.log(`EEES certification state: ${state}`);
if (state === "STALE" || state === "NOT_CERTIFIED") process.exit(1);
