import fs from "fs";

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .filter(Boolean)
        .filter((line) => !line.trim().startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return process.env;
  }
}

function requireEnv(value, label) {
  const normalized = (value ?? "").toString().trim();
  if (!normalized) {
    throw new Error(`${label} is missing.`);
  }
  return normalized;
}

function getBukApiBaseUrl(env) {
  const employeesUrl = (env.BUK_EMPLOYEES_URL ?? "https://busesjm.buk.cl/api/v1/chile/employees")
    .toString()
    .trim();
  return employeesUrl.replace(/\/employees\/?$/, "");
}

async function fetchBukEndpoint(url, authToken) {
  const response = await fetch(url, {
    headers: {
      auth_token: authToken,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();

  return {
    url,
    status: response.status,
    ok: response.ok,
    bodySnippet: body.slice(0, 200).replace(/\s+/g, " "),
  };
}

async function main() {
  const env = readEnvFile();
  const authToken = requireEnv(env.BUK_AUTH_TOKEN, "BUK_AUTH_TOKEN");
  const baseUrl = getBukApiBaseUrl(env);

  const checks = [
    { key: "employees", path: "/employees?page=1&page_size=1" },
    { key: "vacations", path: "/vacations?page=1&page_size=1" },
    { key: "absences", path: "/absences?page=1&page_size=1" },
  ];

  const results = [];
  for (const check of checks) {
    results.push({
      key: check.key,
      ...(await fetchBukEndpoint(`${baseUrl}${check.path}`, authToken)),
    });
  }

  console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));

  const missingScopes = results.filter((result) => !result.ok);
  if (missingScopes.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
