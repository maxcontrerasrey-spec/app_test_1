import fs from "fs";
import { spawnSync } from "child_process";

import { createClient } from "@supabase/supabase-js";

const INSTRUCTORS = [
  {
    fullName: "Marcelo Barrera Acevedo",
    documentNumber: "13.364.290-0",
    email: "Marcelo.Barrera@busesjm.com",
  },
  {
    fullName: "Daniel Carvajal Bucarey",
    documentNumber: "10.528.715-1",
    email: "daniel.carvajal@busesjm.com",
  },
  {
    fullName: "Fernando Maza Roman",
    documentNumber: "12.476.744-k",
    email: "Fernando.Maza@busesjm.com",
  },
  {
    fullName: "Gilberto Urtubia Carvajal",
    documentNumber: "9.249.626-0",
    email: "Gilberto.Urtubia@busesjm.com",
  },
  {
    fullName: "Guillermo Milla Miranda",
    documentNumber: "15.325.100-2",
    email: "guillermo.milla@busesjm.com",
  },
];

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
  return {
    apply: argv.includes("--apply"),
    sendInvites: !argv.includes("--no-invite"),
    createAuthWithoutEmail: argv.includes("--create-auth-without-email"),
  };
}

function normalizeEmail(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function normalizeDocument(value) {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^0-9k]/g, "");
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

async function ensureAuthUser(adminClient, existingUsersByEmail, instructor, options) {
  const email = normalizeEmail(instructor.email);
  const existingUser = existingUsersByEmail.get(email);
  const metadata = {
    full_name: instructor.fullName,
    name: instructor.fullName,
    job_title: "Instructor",
    document_number: instructor.documentNumber,
    role_name: "Instructor",
  };

  if (existingUser) {
    if (!options.apply) {
      return { user: existingUser, action: "would_update_metadata" };
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
      email,
      user_metadata: {
        ...(existingUser.user_metadata ?? {}),
        ...metadata,
      },
    });

    if (error) {
      throw new Error(`No se pudo actualizar Auth para ${email}: ${error.message}`);
    }

    return { user: data.user, action: "updated_metadata" };
  }

  if (!options.apply) {
    return {
      user: { id: null, email },
      action: options.sendInvites
        ? "would_invite"
        : options.createAuthWithoutEmail
          ? "would_create_auth_without_email"
          : "would_create_missing_auth",
    };
  }

  if (!options.sendInvites && !options.createAuthWithoutEmail) {
    throw new Error(`No existe Auth user para ${email} y --no-invite impide crearlo.`);
  }

  const { data, error } = options.sendInvites
    ? await adminClient.auth.admin.inviteUserByEmail(email, {
        data: metadata,
      })
    : await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });

  if (error) {
    throw new Error(`No se pudo invitar a ${email}: ${error.message}`);
  }

  if (!data.user?.id) {
    throw new Error(`La invitacion de ${email} no devolvio user.id.`);
  }

  return { user: data.user, action: options.sendInvites ? "invited" : "created_auth_without_email" };
}

async function fetchCurrentState(adminClient) {
  const emails = INSTRUCTORS.map((entry) => normalizeEmail(entry.email));

  const [{ data: profileRows, error: profileError }, { data: roleRows, error: roleError }, { data: instructorRows, error: instructorError }] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id,email,full_name,job_title,status,must_reset_password,aup_accepted_at")
        .in("email", emails),
      adminClient.from("user_roles").select("user_id,role_code"),
      adminClient.from("competency_instructors").select("id,user_id,full_name,document_number,profile_code,status"),
    ]);

  if (profileError) {
    throw new Error(`No se pudieron leer profiles: ${profileError.message}`);
  }

  if (roleError) {
    throw new Error(`No se pudieron leer user_roles: ${roleError.message}`);
  }

  if (instructorError) {
    throw new Error(`No se pudieron leer competency_instructors: ${instructorError.message}`);
  }

  return {
    profilesByEmail: new Map((profileRows ?? []).map((row) => [normalizeEmail(row.email), row])),
    rolesByUserId: (roleRows ?? []).reduce((accumulator, row) => {
      const current = accumulator.get(row.user_id) ?? new Set();
      current.add(row.role_code);
      accumulator.set(row.user_id, current);
      return accumulator;
    }, new Map()),
    instructorsByDocument: new Map(
      (instructorRows ?? []).map((row) => [normalizeDocument(row.document_number), row]),
    ),
  };
}

async function provisionInstructor(adminClient, existingUsersByEmail, state, instructor, options) {
  const email = normalizeEmail(instructor.email);
  const documentKey = normalizeDocument(instructor.documentNumber);
  const instructorRow = state.instructorsByDocument.get(documentKey);

  if (!instructorRow || instructorRow.status !== "active") {
    throw new Error(`No existe instructor activo para ${instructor.fullName} (${instructor.documentNumber}).`);
  }

  const authResult = await ensureAuthUser(adminClient, existingUsersByEmail, instructor, options);
  const authUser = authResult.user;
  const existingProfile = state.profilesByEmail.get(email);
  const targetUserId = authUser.id ?? existingProfile?.id ?? instructorRow.user_id;

  if (!targetUserId) {
    return {
      email,
      fullName: instructor.fullName,
      documentNumber: instructor.documentNumber,
      authAction: authResult.action,
      profileAction: "would_upsert_after_invite",
      roleAction: "would_assign_after_invite",
      instructorAction: "would_link_after_invite",
    };
  }

  return {
    email,
    fullName: instructor.fullName,
    documentNumber: instructor.documentNumber,
    authAction: authResult.action,
    profileAction: existingProfile ? "updated_profile" : "created_profile",
    roleAction: state.rolesByUserId.get(targetUserId)?.has("instructor") ? "role_already_present" : "assigned_instructor",
    instructorAction: instructorRow.user_id === targetUserId ? "instructor_already_linked" : "linked_instructor",
    userId: targetUserId,
    instructorId: instructorRow.id,
    profileCode: instructorRow.profile_code,
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildProvisioningSql() {
  const valuesSql = INSTRUCTORS.map((instructor) => `(${[
    sqlLiteral(instructor.fullName),
    sqlLiteral(instructor.documentNumber),
    sqlLiteral(normalizeEmail(instructor.email)),
  ].join(", ")})`).join(",\n    ");

  return `
begin;

do $$
declare
  missing_auth_count integer;
  missing_instructor_count integer;
begin
  with desired(full_name, document_number, email) as (
    values
      ${valuesSql}
  )
  select count(*)
    into missing_auth_count
  from desired d
  where not exists (
    select 1
    from auth.users au
    where lower(au.email) = d.email
  );

  if missing_auth_count > 0 then
    raise exception 'Faltan usuarios Auth para instructores: %', missing_auth_count;
  end if;

  with desired(full_name, document_number, email) as (
    values
      ${valuesSql}
  )
  select count(*)
    into missing_instructor_count
  from desired d
  where not exists (
    select 1
    from public.competency_instructors ci
    where regexp_replace(lower(ci.document_number), '[^0-9k]', '', 'g') = regexp_replace(lower(d.document_number), '[^0-9k]', '', 'g')
      and ci.status = 'active'
  );

  if missing_instructor_count > 0 then
    raise exception 'Faltan instructores activos para vincular: %', missing_instructor_count;
  end if;
end $$;

with desired(full_name, document_number, email) as (
  values
    ${valuesSql}
),
auth_matches as (
  select
    au.id as user_id,
    d.email,
    d.full_name,
    d.document_number
  from desired d
  join auth.users au
    on lower(au.email) = d.email
)
insert into public.profiles (
  id,
  email,
  full_name,
  job_title,
  status,
  updated_at
)
select
  user_id,
  email,
  full_name,
  'Instructor',
  'active',
  timezone('utc', now())
from auth_matches
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    job_title = excluded.job_title,
    status = excluded.status,
    updated_at = excluded.updated_at;

with desired(full_name, document_number, email) as (
  values
    ${valuesSql}
),
auth_matches as (
  select au.id as user_id
  from desired d
  join auth.users au
    on lower(au.email) = d.email
)
insert into public.user_roles (
  user_id,
  role_code,
  assigned_by
)
select
  user_id,
  'instructor',
  null::uuid
from auth_matches
on conflict (user_id, role_code) do nothing;

with desired(full_name, document_number, email) as (
  values
    ${valuesSql}
),
auth_matches as (
  select
    au.id as user_id,
    d.full_name,
    d.document_number
  from desired d
  join auth.users au
    on lower(au.email) = d.email
)
update public.competency_instructors ci
set user_id = am.user_id,
    full_name = am.full_name,
    updated_at = timezone('utc', now())
from auth_matches am
where regexp_replace(lower(ci.document_number), '[^0-9k]', '', 'g') = regexp_replace(lower(am.document_number), '[^0-9k]', '', 'g')
  and ci.status = 'active';

notify pgrst, 'reload schema';

commit;
`;
}

function runProvisioningSql() {
  const result = spawnSync("npx", ["supabase", "db", "query", "--linked", buildProvisioningSql()], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`Fallo SQL administrativo de provisioning: ${result.stderr || result.stdout}`);
  }
}

async function validateProvisioning(adminClient) {
  const emails = INSTRUCTORS.map((entry) => normalizeEmail(entry.email));
  const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }, { data: instructorRows, error: instructorsError }] =
    await Promise.all([
      adminClient
        .from("profiles")
        .select("id,email,full_name,job_title,status")
        .in("email", emails)
        .order("email", { ascending: true }),
      adminClient.from("user_roles").select("user_id,role_code").eq("role_code", "instructor"),
      adminClient.from("competency_instructors").select("id,user_id,document_number,profile_code,status"),
    ]);

  if (profilesError) {
    throw new Error(`No se pudieron validar profiles: ${profilesError.message}`);
  }

  if (rolesError) {
    throw new Error(`No se pudieron validar roles: ${rolesError.message}`);
  }

  if (instructorsError) {
    throw new Error(`No se pudieron validar instructores: ${instructorsError.message}`);
  }

  const instructorRoles = new Set((roleRows ?? []).map((row) => row.user_id));
  const instructorsByUserId = (instructorRows ?? []).reduce((accumulator, row) => {
    const current = accumulator.get(row.user_id) ?? [];
    current.push(row);
    accumulator.set(row.user_id, current);
    return accumulator;
  }, new Map());

  return (profiles ?? []).map((row) => {
    const linkedInstructors = instructorsByUserId.get(row.id) ?? [];
    return {
      email: row.email,
      fullName: row.full_name,
      status: row.status,
      hasInstructorRole: instructorRoles.has(row.id),
      linkedInstructorCount: linkedInstructors.filter((item) => item.status === "active").length,
      instructorProfileCodes: linkedInstructors.map((item) => item.profile_code).filter(Boolean),
    };
  });
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existingUsersByEmail = await listAuthUsersByEmail(adminClient);
  const state = await fetchCurrentState(adminClient);
  const results = [];

  for (const instructor of INSTRUCTORS) {
    results.push(await provisionInstructor(adminClient, existingUsersByEmail, state, instructor, options));
  }

  if (options.apply) {
    runProvisioningSql();
  }

  const validation = options.apply ? await validateProvisioning(adminClient) : [];

  console.log(
    JSON.stringify(
      {
        ok: true,
        applied: options.apply,
        sendInvites: options.sendInvites,
        createAuthWithoutEmail: options.createAuthWithoutEmail,
        instructorCount: INSTRUCTORS.length,
        results,
        validation,
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
