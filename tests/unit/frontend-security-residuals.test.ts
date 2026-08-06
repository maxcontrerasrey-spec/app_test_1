import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe("frontend security residuals", () => {
  it("pins the patched React and React Router baseline", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>;
      engines: Record<string, string>;
    };

    expect(packageJson.dependencies.react).toBe("19.2.7");
    expect(packageJson.dependencies["react-dom"]).toBe("19.2.7");
    expect(packageJson.dependencies["react-router"]).toBe("8.3.0");
    expect(packageJson.dependencies["react-router-dom"]).toBeUndefined();
    expect(packageJson.engines.node).toBe(">=22.22.0");
    expect(read(".node-version").trim()).toBe("22.22.0");
  });

  it("does not retain the removed react-router-dom compatibility package", () => {
    for (const file of sourceFiles(path.join(root, "src"))) {
      expect(fs.readFileSync(file, "utf8"), file).not.toContain("react-router-dom");
    }
  });

  it("ships conservative anti-clickjacking headers without unsafe HSTS expansion", () => {
    const headers = read("public/_headers");

    expect(headers).toContain(
      "Content-Security-Policy: frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    );
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Strict-Transport-Security: max-age=31536000");
    expect(headers).not.toContain("includeSubDomains");
    expect(headers).not.toContain("preload");
    expect(headers).toContain("/assets/*\n  ! Cache-Control\n  Cache-Control: public");
  });
});
