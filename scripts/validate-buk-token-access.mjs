import fs from "fs";

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .filter(Boolean)
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

function optionalEnv(value) {
  const normalized = (value ?? "").toString().trim();
  return normalized || null;
}

function getEmployeesBaseUrl(env) {
  return optionalEnv(env.BUK_EMPLOYEES_URL) ?? "https://busesjm.buk.cl/api/v1/chile/employees";
}

function getLocationsBaseUrl(env) {
  if (optionalEnv(env.BUK_LOCATIONS_URL)) {
    return optionalEnv(env.BUK_LOCATIONS_URL);
  }

  const url = new URL(getEmployeesBaseUrl(env));
  url.pathname = url.pathname.replace(/\/employees$/, "/locations");
  url.search = "";
  return url.toString();
}

function getDocumentsUrl(env, employeeId) {
  const template =
    optionalEnv(env.BUK_EMPLOYEE_DOCUMENTS_URL_TEMPLATE) ??
    `${getEmployeesBaseUrl(env)}/{employee_id}/documents`;

  return template.replace("{employee_id}", encodeURIComponent(String(employeeId)));
}

async function fetchBuk(url, authToken, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      auth_token: authToken,
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body: text
  };
}

async function main() {
  const env = {
    ...readEnvFile(),
    ...process.env
  };

  const authToken = requireEnv(env.BUK_AUTH_TOKEN, "BUK_AUTH_TOKEN");
  const summary = [];

  const employeesUrl = new URL(getEmployeesBaseUrl(env));
  employeesUrl.searchParams.set("page", "1");
  employeesUrl.searchParams.set("page_size", "1");
  const employeesProbe = await fetchBuk(employeesUrl.toString(), authToken);
  summary.push({
    probe: "GET /employees",
    ok: employeesProbe.ok,
    status: employeesProbe.status
  });

  const locationsUrl = new URL(getLocationsBaseUrl(env));
  locationsUrl.searchParams.set("page", "1");
  locationsUrl.searchParams.set("page_size", "1");
  const locationsProbe = await fetchBuk(locationsUrl.toString(), authToken);
  summary.push({
    probe: "GET /locations",
    ok: locationsProbe.ok,
    status: locationsProbe.status
  });

  const createEmployeePayload =
    optionalEnv(env.BUK_VALIDATE_CREATE_EMPLOYEE_PAYLOAD_JSON)
      ? JSON.parse(env.BUK_VALIDATE_CREATE_EMPLOYEE_PAYLOAD_JSON)
      : null;

  if (createEmployeePayload) {
    const createProbe = await fetchBuk(getEmployeesBaseUrl(env), authToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createEmployeePayload)
    });
    summary.push({
      probe: "POST /employees",
      ok: createProbe.ok,
      status: createProbe.status
    });
  } else {
    summary.push({
      probe: "POST /employees",
      ok: false,
      status: "skipped",
      note: "Define BUK_VALIDATE_CREATE_EMPLOYEE_PAYLOAD_JSON para validar escritura real."
    });
  }

  const documentEmployeeId = optionalEnv(env.BUK_VALIDATE_DOCUMENT_EMPLOYEE_ID);
  const documentFilePath = optionalEnv(env.BUK_VALIDATE_DOCUMENT_FILE);

  if (documentEmployeeId && documentFilePath) {
    const fileBuffer = fs.readFileSync(documentFilePath);
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), documentFilePath.split("/").pop() ?? "test.pdf");
    formData.append("name", documentFilePath.split("/").pop() ?? "test.pdf");

    const documentProbe = await fetch(getDocumentsUrl(env, documentEmployeeId), {
      method: "POST",
      headers: {
        auth_token: authToken
      },
      body: formData
    });

    summary.push({
      probe: "POST /employees/{id}/documents",
      ok: documentProbe.ok,
      status: documentProbe.status
    });
  } else {
    summary.push({
      probe: "POST /employees/{id}/documents",
      ok: false,
      status: "skipped",
      note: "Define BUK_VALIDATE_DOCUMENT_EMPLOYEE_ID y BUK_VALIDATE_DOCUMENT_FILE para validar subida real."
    });
  }

  console.log(JSON.stringify({ summary }, null, 2));

  const failedRequired = summary.some(
    (item) =>
      (item.probe === "GET /employees" || item.probe === "GET /locations") &&
      item.ok !== true,
  );

  if (failedRequired) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
