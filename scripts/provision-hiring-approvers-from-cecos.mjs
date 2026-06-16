import fs from "fs";
import path from "path";

import { createClient } from "@supabase/supabase-js";
import XLSX from "@mylinkpi/xlsx";

const DEFAULT_INPUT_PATH = "/Users/maximilianocontrerasrey/Documents/GitHub/bbdd-cecos.xlsx";
const USERS_SHEET_NAME = "Hoja1";
const CECOS_SHEET_NAME = "Hoja2";

const EMAIL_OVERRIDES = {
  "cjimenez@busesjm.co": "cjimenez@busesjm.com",
};

const ROLE_DEFINITIONS = [
  {
    code: "aprobador_folios",
    name: "Aprobador de Folios",
    description: "Aprueba solicitudes de contratación cuando es designado como responsable de área.",
  },
];

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

function requiredText(value, label, rowNumber) {
  const normalized = (value ?? "").toString().trim();

  if (!normalized) {
    throw new Error(`Fila ${rowNumber}: falta ${label}.`);
  }

  return normalized;
}

function parseArgs(argv) {
  const options = {
    file: DEFAULT_INPUT_PATH,
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
    }
  }

  return options;
}

function readWorkbook(filePath) {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const usersSheet = workbook.Sheets[USERS_SHEET_NAME];
  const cecosSheet = workbook.Sheets[CECOS_SHEET_NAME];

  if (!usersSheet || !cecosSheet) {
    throw new Error(`El archivo debe contener las hojas ${USERS_SHEET_NAME} y ${CECOS_SHEET_NAME}.`);
  }

  return {
    users: XLSX.utils.sheet_to_json(usersSheet, { defval: null, raw: false }),
    cecos: XLSX.utils.sheet_to_json(cecosSheet, { defval: null, raw: false }),
  };
}

function parseUsers(rawUsers) {
  const usersByName = new Map();

  rawUsers.forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = requiredText(row.Nombre, "Nombre", rowNumber);
    const email = normalizeEmail(requiredText(row.usuario, "usuario", rowNumber));
    const jobTitle = requiredText(row.Cargo, "Cargo", rowNumber);
    const password = requiredText(row.Pass, "Pass", rowNumber);

    usersByName.set(normalizeText(fullName), {
      rowNumber,
      fullName,
      email,
      jobTitle,
      password,
    });
  });

  return usersByName;
}

function parseCostCenters(rawCecos, usersByName) {
  const entriesByCostCenter = new Map();
  const rows = [];
  const missingUsers = [];
  const conflicts = new Map();

  rawCecos.forEach((row, index) => {
    const rowNumber = index + 2;
    const costCenterCode = requiredText(row["Centro de Costo"], "Centro de Costo", rowNumber);
    const costCenterName = requiredText(row["Descripción Centro de Costo"], "Descripción Centro de Costo", rowNumber);
    const managerName = requiredText(row["Gerente Area"], "Gerente Area", rowNumber);
    const manager = usersByName.get(normalizeText(managerName));
    const entry = {
      rowNumber,
      contractNumber: requiredText(row.Proyecto, "Proyecto", rowNumber),
      contractName: requiredText(row["Descripcion Proyecto"], "Descripcion Proyecto", rowNumber),
      costUnit: requiredText(row["Unidad de Costo"], "Unidad de Costo", rowNumber),
      costUnitName: requiredText(row["Descripción Unidad de Costo"], "Descripción Unidad de Costo", rowNumber),
      costCenterCode,
      costCenterName,
      bukAreaName: requiredText(row.Area_Buk, "Area_Buk", rowNumber),
      managerName,
      manager,
      contractAdminName: requiredText(row["Administrador de Contrato"], "Administrador de Contrato", rowNumber),
    };

    rows.push(entry);

    if (!manager) {
      missingUsers.push({
        rowNumber,
        contractNumber: entry.contractNumber,
        contractName: entry.contractName,
        costCenterCode,
        managerName,
      });
      return;
    }

    const existing = entriesByCostCenter.get(costCenterCode);
    if (existing && normalizeText(existing.managerName) !== normalizeText(managerName)) {
      conflicts.set(costCenterCode, [
        ...(conflicts.get(costCenterCode) ?? [existing]),
        entry,
      ]);
      return;
    }

    entriesByCostCenter.set(costCenterCode, entry);
  });

  return {
    rows,
    entries: [...entriesByCostCenter.values()],
    missingUsers,
    conflicts: [...conflicts.entries()].map(([costCenterCode, entries]) => ({
      costCenterCode,
      managers: [...new Set(entries.map((entry) => entry.managerName))],
      contracts: entries.map((entry) => `${entry.contractNumber} ${entry.contractName}`),
    })),
  };
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

async function ensureAuthUser(adminClient, existingUsersByEmail, manager) {
  const existingUser = existingUsersByEmail.get(manager.email);
  const userMetadata = {
    full_name: manager.fullName,
    name: manager.fullName,
    job_title: manager.jobTitle,
  };

  if (existingUser) {
    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      email: manager.email,
      email_confirm: true,
      user_metadata: userMetadata,
    });

    if (error) {
      throw new Error(`No se pudo actualizar auth user ${manager.email}: ${error.message}`);
    }

    return {
      user: data.user,
      created: false,
    };
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email: manager.email,
    password: manager.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (error) {
    throw new Error(`No se pudo crear auth user ${manager.email}: ${error.message}`);
  }

  return {
    user: data.user,
    created: true,
  };
}

async function ensureRoleDefinitions(adminClient) {
  const { error } = await adminClient.from("app_roles").upsert(ROLE_DEFINITIONS, {
    onConflict: "code",
  });

  if (error) {
    throw new Error(`No se pudieron asegurar roles base: ${error.message}`);
  }
}

async function upsertManagerIdentity(adminClient, authUser, manager, wasCreated) {
  const profilePayload = {
    id: authUser.id,
    email: manager.email,
    full_name: manager.fullName,
    job_title: manager.jobTitle,
    status: "active",
    updated_at: new Date().toISOString(),
  };

  if (wasCreated) {
    profilePayload.must_reset_password = true;
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    profilePayload,
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`No se pudo sincronizar profile ${manager.email}: ${profileError.message}`);
  }

  const { error: roleError } = await adminClient.from("user_roles").upsert(
    {
      user_id: authUser.id,
      role_code: "aprobador_folios",
      assigned_by: null,
    },
    { onConflict: "user_id,role_code" },
  );

  if (roleError) {
    throw new Error(`No se pudo asignar rol aprobador_folios a ${manager.email}: ${roleError.message}`);
  }
}

async function upsertCostCenterApprover(adminClient, authUser, entry) {
  const { error } = await adminClient.from("cost_center_approvers").upsert(
    {
      cost_center_code: entry.costCenterCode,
      cost_center_name: entry.costCenterName,
      approver_user_id: authUser.id,
      approver_name: entry.manager.fullName,
      approver_email: entry.manager.email,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cost_center_code" },
  );

  if (error) {
    throw new Error(`No se pudo vincular el centro de costo ${entry.costCenterCode}: ${error.message}`);
  }
}

async function fetchContractsMissingApprover(adminClient) {
  const { data: contracts, error: contractsError } = await adminClient
    .from("contracts")
    .select("code, contract_number, contract_name, cost_center_code, cost_center_name")
    .eq("is_active", true)
    .order("code");

  if (contractsError) {
    throw contractsError;
  }

  const { data: approvers, error: approversError } = await adminClient
    .from("cost_center_approvers")
    .select("cost_center_code, approver_user_id, is_active");

  if (approversError) {
    throw approversError;
  }

  const activeApproverCodes = new Set(
    (approvers ?? [])
      .filter((approver) => approver.is_active && approver.approver_user_id)
      .map((approver) => String(approver.cost_center_code)),
  );

  return (contracts ?? []).filter((contract) => !activeApproverCodes.has(String(contract.cost_center_code)));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workbookPath = path.resolve(options.file);
  const { users, cecos } = readWorkbook(workbookPath);
  const usersByName = parseUsers(users);
  const parsed = parseCostCenters(cecos, usersByName);

  const summary = {
    file: workbookPath,
    userRows: users.length,
    cecoRows: cecos.length,
    provisionableCostCenters: parsed.entries.length,
    missingUsers: parsed.missingUsers,
    conflictingCostCenters: parsed.conflicts,
  };

  if (options.dryRun) {
    console.log(JSON.stringify({ mode: "dry-run", summary }, null, 2));
    return;
  }

  const env = { ...readEnvFile(), ...process.env };
  const supabaseUrl = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureRoleDefinitions(adminClient);

  const existingUsersByEmail = await listAuthUsersByEmail(adminClient);
  const results = [];

  for (const entry of parsed.entries) {
    const { user: authUser, created } = await ensureAuthUser(adminClient, existingUsersByEmail, entry.manager);
    existingUsersByEmail.set(entry.manager.email, authUser);
    await upsertManagerIdentity(adminClient, authUser, entry.manager, created);
    await upsertCostCenterApprover(adminClient, authUser, entry);
    results.push({
      costCenterCode: entry.costCenterCode,
      costCenterName: entry.costCenterName,
      managerName: entry.manager.fullName,
      managerEmail: entry.manager.email,
      userId: authUser.id,
    });
  }

  const contractsStillMissingApprover = await fetchContractsMissingApprover(adminClient);

  console.log(JSON.stringify({
    mode: "apply",
    summary,
    applied: results,
    contractsStillMissingApprover,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
