import type { User } from "@supabase/supabase-js";

export type AppRole =
  | "admin"
  | "reclutamiento"
  | "control_contratos"
  | "certificaciones"
  | "instructor"
  | "guest";

const SUPER_ADMIN_EMAILS = new Set(["maximiliano.contreras@busesjm.com"]);

const ROLE_ALIASES: Record<string, AppRole> = {
  admin: "admin",
  administrador: "admin",
  reclutamiento: "reclutamiento",
  recruitment: "reclutamiento",
  control_contratos: "control_contratos",
  "control contratos": "control_contratos",
  certificaciones: "certificaciones",
  certificacion: "certificaciones",
  certifications: "certificaciones",
  instructor: "instructor"
};

function normalizeRoleCandidate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return ROLE_ALIASES[normalized] ?? null;
}

export function resolveAppRole(user: User | null): AppRole {
  const email = user?.email?.trim().toLowerCase();
  if (email && SUPER_ADMIN_EMAILS.has(email)) {
    return "admin";
  }

  const candidates = [
    user?.user_metadata?.app_role,
    user?.user_metadata?.platform_role,
    user?.user_metadata?.role
  ];

  for (const candidate of candidates) {
    const role = normalizeRoleCandidate(candidate);
    if (role) {
      return role;
    }
  }

  return "guest";
}

export function hasRoleAccess(role: AppRole, allowedRoles: AppRole[]) {
  return allowedRoles.includes(role);
}
