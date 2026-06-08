import fs from "fs";

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const DEFAULT_INPUT_PATH = "/Users/maximilianocontrerasrey/Documents/GitHub/usuarios_busesjm.xlsx";
const DEFAULT_SHEET_NAME = "usuarios";
const DEFAULT_PASSWORD = "Bjm2026*";

function readEnvFile() {
  try {
    return Object.fromEntries(
      fs
        .readFileSync(".env.local", "utf8")
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const options = {
    file: DEFAULT_INPUT_PATH,
    sheet: DEFAULT_SHEET_NAME,
    password: DEFAULT_PASSWORD,
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

    if (arg === "--password") {
      options.password = argv[index + 1];
      index += 1;
    }
  }

  return options;
}

function normalizeEmail(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = (value ?? "").toString().trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "si" || normalized === "sí";
}

function ensureValue(value, label, rowNumber) {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`Fila ${rowNumber}: falta ${label}.`);
  }

  return String(value).trim();
}

function readMatrix(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`No existe la hoja "${sheetName}" en ${filePath}.`);
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });

  const seenEmails = new Set();

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const email = normalizeEmail(ensureValue(row.email, "email", rowNumber));
    const fullName = ensureValue(row.full_name, "full_name", rowNumber);
    const jobTitle = ensureValue(row.job_title, "job_title", rowNumber);
    const department = row.department ? String(row.department).trim() : null;
    const isSuperAdmin = normalizeBoolean(row.is_super_admin);

    if (seenEmails.has(email)) {
      throw new Error(`Fila ${rowNumber}: el correo ${email} está duplicado.`);
    }

    seenEmails.add(email);

    return {
      email,
      fullName,
      jobTitle,
      department,
      isSuperAdmin,
    };
  });
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

async function createMissingUsers(adminClient, entries, password, dryRun) {
  const existingUsersByEmail = await listAuthUsersByEmail(adminClient);
  const created = [];
  const skipped = [];

  for (const entry of entries) {
    if (existingUsersByEmail.has(entry.email)) {
      skipped.push(entry.email);
      continue;
    }

    if (dryRun) {
      created.push(entry.email);
      continue;
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: entry.email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: entry.fullName,
        name: entry.fullName,
        job_title: entry.jobTitle,
        department: entry.department,
        is_super_admin: entry.isSuperAdmin,
      },
    });

    if (error) {
      throw new Error(`No se pudo crear ${entry.email}: ${error.message}`);
    }

    created.push(data.user?.email ?? entry.email);
  }

  return { created, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = {
    ...readEnvFile(),
    ...process.env,
  };

  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan VITE_SUPABASE_URL/SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  const entries = readMatrix(options.file, options.sheet);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const result = await createMissingUsers(adminClient, entries, options.password, options.dryRun);

  console.log(
    JSON.stringify(
      {
        file: options.file,
        sheet: options.sheet,
        dryRun: options.dryRun,
        createdCount: result.created.length,
        skippedCount: result.skipped.length,
        created: result.created,
        skipped: result.skipped,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
