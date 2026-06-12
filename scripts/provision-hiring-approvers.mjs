import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";
import XLSX from "@mylinkpi/xlsx";

const DEFAULT_INPUT_PATH = "/Users/maximilianocontrerasrey/Desktop/bbdd-cecos.xlsx";
const DEFAULT_SHEET_NAME = "Hoja1";

const ROLE_DEFINITIONS = [
  {
    code: "aprobador_folios",
    name: "Aprobador de Folios",
    description: "Aprueba o rechaza solicitudes de contratacion en la cadena secuencial.",
  },
  {
    code: "control_contratos",
    name: "Control de Contratos",
    description: "Seguimiento y control del proceso contractual.",
  },
];

const ROLE_MAPPING = {
  "aprobador area": ["aprobador_folios"],
  "aprobador control de contratos": ["control_contratos", "aprobador_folios"],
};

const EMAIL_OVERRIDES = {
  "cjimenez@busesjm.co": "cjimenez@busesjm.com",
};

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
    return {};
  }
}

function normalizeText(value) {
  return (value ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeEmail(value) {
  const normalized = (value ?? "").toString().trim().toLowerCase();
  return EMAIL_OVERRIDES[normalized] ?? normalized;
}

function parseArgs(argv) {
  const options = {
    file: DEFAULT_INPUT_PATH,
    sheet: DEFAULT_SHEET_NAME,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--file") {
      options.file = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--sheet") {
      options.sheet = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
}

function ensureValue(value, label, rowNumber) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`Fila ${rowNumber}: falta ${label}.`);
  }

  return String(value).trim();
}

function readWorkbookRows(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`No existe la hoja "${sheetName}" en ${filePath}.`);
  }

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });
}

function mapRoleCodes(rawRole, rowNumber) {
  const normalizedRole = normalizeText(rawRole);
  const roleCodes = ROLE_MAPPING[normalizedRole];

  if (!roleCodes) {
    throw new Error(`Fila ${rowNumber}: rol no soportado "${rawRole}".`);
  }

  return roleCodes;
}

function parseRows(rawRows) {
  const users = [];
  const seenEmails = new Set();
  const seenCostCenters = new Set();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = ensureValue(row.Gerente, "Gerente", rowNumber);
    const email = normalizeEmail(ensureValue(row.usuario, "usuario", rowNumber));
    const jobTitle = ensureValue(row.Cargo, "Cargo", rowNumber);
    const rawRole = ensureValue(row.Rol, "Rol", rowNumber);
    const password = ensureValue(row.Pass, "Pass", rowNumber);
    const roleCodes = mapRoleCodes(rawRole, rowNumber);
    const costCenterCode = row["Centro de Costo"] ? String(row["Centro de Costo"]).trim() : null;
    const costCenterName = row["Descripción Centro de Costo"]
      ? String(row["Descripción Centro de Costo"]).trim()
      : null;

    if (seenEmails.has(email)) {
      throw new Error(`Fila ${rowNumber}: el correo ${email} está duplicado en el Excel.`);
    }

    seenEmails.add(email);

    if (roleCodes.includes("aprobador_folios") && !roleCodes.includes("control_contratos")) {
      if (!costCenterCode || !costCenterName) {
        throw new Error(`Fila ${rowNumber}: falta Centro de Costo o Descripción Centro de Costo para aprobador de área.`);
      }

      if (seenCostCenters.has(costCenterCode)) {
        throw new Error(`Fila ${rowNumber}: el centro de costo ${costCenterCode} está duplicado en el Excel.`);
      }

      seenCostCenters.add(costCenterCode);
    }

    users.push({
      rowNumber,
      fullName,
      email,
      jobTitle,
      password,
      rawRole,
      roleCodes,
      costCenterCode,
      costCenterName,
      isContractsControl: roleCodes.includes("control_contratos"),
    });
  });

  return users;
}

async function listAuthUsersByEmail(adminClient) {
  const byEmail = new Map();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users ?? []) {
      if (!user.email) continue;
      byEmail.set(normalizeEmail(user.email), user);
    }

    totalPages = data?.total ? Math.max(1, Math.ceil(data.total / 200)) : page;
    page += 1;
  }

  return byEmail;
}

async function ensureAuthUser(adminClient, existingUsersByEmail, entry) {
  const existingUser = existingUsersByEmail.get(entry.email);
  const userMetadata = {
    full_name: entry.fullName,
    name: entry.fullName,
    job_title: entry.jobTitle,
    role_name: entry.rawRole,
  };

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      email: entry.email,
      password: entry.password,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) {
      throw new Error(`No se pudo actualizar auth user ${entry.email}: ${error.message}`);
    }

    return data.user;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: entry.email,
    password: entry.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    throw new Error(`No se pudo crear auth user ${entry.email}: ${error.message}`);
  }

  return data.user;
}

async function upsertProfile(adminClient, authUser, entry) {
  const { error } = await adminClient.from("profiles").upsert(
    {
      id: authUser.id,
      email: entry.email,
      full_name: entry.fullName,
      job_title: entry.jobTitle,
      status: "active",
      must_reset_password: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw new Error(`No se pudo sincronizar profile ${entry.email}: ${error.message}`);
  }
}

async function ensureRoles(adminClient, authUser, entry) {
  const roleRows = entry.roleCodes.map((roleCode) => ({
    user_id: authUser.id,
    role_code: roleCode,
    assigned_by: null,
  }));

  const { error } = await adminClient.from("user_roles").upsert(roleRows, {
    onConflict: "user_id,role_code",
  });

  if (error) {
    throw new Error(`No se pudieron asignar roles a ${entry.email}: ${error.message}`);
  }
}

async function upsertAreaApprover(adminClient, authUser, entry) {
  if (entry.isContractsControl) {
    return;
  }

  const { error } = await adminClient.from("cost_center_approvers").upsert(
    {
      cost_center_code: entry.costCenterCode,
      cost_center_name: entry.costCenterName,
      approver_user_id: authUser.id,
      approver_name: entry.fullName,
      approver_email: entry.email,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "cost_center_code",
    },
  );

  if (error) {
    throw new Error(`No se pudo vincular el centro de costo ${entry.costCenterCode}: ${error.message}`);
  }
}

async function upsertContractsControl(adminClient, authUser, entry) {
  if (!entry.isContractsControl) {
    return;
  }

  const { error } = await adminClient.from("workflow_approvers").upsert(
    {
      step_code: "contracts_control",
      approver_user_id: authUser.id,
      approver_name: entry.fullName,
      approver_email: entry.email,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "step_code",
    },
  );

  if (error) {
    throw new Error(`No se pudo vincular Control de Contratos: ${error.message}`);
  }
}

async function ensureRoleDefinitions(adminClient) {
  const { error } = await adminClient.from("app_roles").upsert(ROLE_DEFINITIONS, {
    onConflict: "code",
  });

  if (error) {
    throw new Error(`No se pudieron asegurar los roles base: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workbookPath = path.resolve(options.file);
  const rawRows = readWorkbookRows(workbookPath, options.sheet);
  const entries = parseRows(rawRows);

  const summary = {
    file: workbookPath,
    sheet: options.sheet,
    totalRows: entries.length,
    areaApprovers: entries.filter((entry) => !entry.isContractsControl).length,
    contractsControl: entries.filter((entry) => entry.isContractsControl).length,
    emails: entries.map((entry) => entry.email),
  };

  if (options.dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", summary, entries }, null, 2));
    process.exit(0);
  }

  const env = {
    ...readEnvFile(),
    ...process.env,
  };

  const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl) {
    throw new Error("Falta SUPABASE_URL o VITE_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para usar la API admin de Supabase.");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  await ensureRoleDefinitions(adminClient);

  const existingUsersByEmail = await listAuthUsersByEmail(adminClient);
  const results = [];

  for (const entry of entries) {
    const authUser = await ensureAuthUser(adminClient, existingUsersByEmail, entry);
    existingUsersByEmail.set(entry.email, authUser);

    await upsertProfile(adminClient, authUser, entry);
    await ensureRoles(adminClient, authUser, entry);
    await upsertAreaApprover(adminClient, authUser, entry);
    await upsertContractsControl(adminClient, authUser, entry);

    results.push({
      email: entry.email,
      userId: authUser.id,
      roleCodes: entry.roleCodes,
      costCenterCode: entry.costCenterCode,
      isContractsControl: entry.isContractsControl,
    });
  }

  console.log(JSON.stringify({ mode: "apply", summary, results }, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
