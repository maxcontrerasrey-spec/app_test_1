import { supabase } from "../../../shared/lib/supabase";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";
import {
  normalizeDsalDisplayText,
  normalizeDsalEmail,
  normalizeDsalPhone
} from "../lib/dsalPrecandidateFormatting";

export const dsalLicenseOptions = [
  { value: "A1 (Ley 18.290)", label: "A1 (Ley 18.290)" },
  { value: "A2", label: "A2" },
  { value: "A3", label: "A3" },
  { value: "B", label: "B" }
] as const;

export const dsalRoleOptions = [
  { value: "Interno Mina", label: "Interno Mina" },
  { value: "Furgón Eléctrico", label: "Furgón Eléctrico" },
  { value: "Bus Eléctrico", label: "Bus Eléctrico" },
  { value: "Ciudades Base", label: "Ciudades Base" },
  { value: "Administrador de Contrato", label: "Administrador de Contrato" },
  { value: "Aseadores", label: "Aseadores" },
  { value: "Bodeguero", label: "Bodeguero" },
  { value: "Electricista Especialista", label: "Electricista Especialista" },
  { value: "Expeditora - Acreditación", label: "Expeditora - Acreditación" },
  { value: "Experto Prevención de riesgos", label: "Experto Prevención de riesgos" },
  {
    value: "Ingeniero especialista Planificación y control",
    label: "Ingeniero especialista Planificación y control"
  },
  { value: "Jefe de Operaciones", label: "Jefe de Operaciones" },
  { value: "Jefe de taller", label: "Jefe de taller" },
  { value: "Mecánico Especialista", label: "Mecánico Especialista" },
  { value: "Mecánico especialista carrocería", label: "Mecánico especialista carrocería" },
  { value: "Personal Administrativo", label: "Personal Administrativo" },
  { value: "Supervisor de Terreno", label: "Supervisor de Terreno" }
] as const;

export type DsalPrecandidateStatus = "pending" | "approved" | "rejected" | "archived";

export type DsalPrecandidate = {
  id: string;
  source_code: "dsal_public";
  status: DsalPrecandidateStatus;
  national_id: string;
  first_name: string;
  last_name: string;
  second_last_name: string;
  full_name: string;
  address_line: string;
  region: string;
  current_city: string;
  driver_license_classes: string[];
  dsal_role: string;
  phone: string;
  personal_email: string;
  comments: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  approved_recruitment_case_id: string | null;
  approved_case_candidate_id: string | null;
  approved_folio: string | null;
  criminal_cause_count: number;
  labor_cause_count: number;
  criminal_cause_details: Array<{ description: string; date: string | null }>;
  labor_cause_details: Array<{ description: string; date: string | null }>;
};

export type DsalRosterIdentity = {
  found: boolean;
  first_name?: string;
  last_name?: string;
  second_last_name?: string;
};

export type DsalPrecandidatesSummary = {
  pending: number;
  approved: number;
  rejected: number;
};

type PagedPrecandidatesPayload = {
  items?: DsalPrecandidate[] | null;
  total_count?: number | null;
  summary?: Partial<DsalPrecandidatesSummary> | null;
};

function parsePrecandidatesPage(payload: unknown) {
  const parsed = (payload ?? {}) as PagedPrecandidatesPayload;
  const summary = parsed.summary ?? {};

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    totalCount: Number(parsed.total_count ?? 0),
    summary: {
      pending: Number(summary.pending ?? 0),
      approved: Number(summary.approved ?? 0),
      rejected: Number(summary.rejected ?? 0)
    }
  };
}

export async function submitDsalPrecandidateApplication(input: {
  nationalId: string;
  firstName: string;
  lastName: string;
  secondLastName: string;
  addressLine: string;
  region: string;
  currentCity: string;
  driverLicenseClasses: string[];
  dsalRole: string;
  phone: string;
  personalEmail: string;
  comments?: string;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("submit_dsal_precandidate_application", {
    p_national_id: normalizeRut(input.nationalId),
    p_first_name: normalizeDsalDisplayText(input.firstName),
    p_last_name: normalizeDsalDisplayText(input.lastName),
    p_second_last_name: normalizeDsalDisplayText(input.secondLastName),
    p_address_line: normalizeDsalDisplayText(input.addressLine),
    p_region: input.region,
    p_current_city: normalizeDsalDisplayText(input.currentCity),
    p_driver_license_classes: input.driverLicenseClasses,
    p_dsal_role: input.dsalRole,
    p_phone: normalizeDsalPhone(input.phone),
    p_personal_email: normalizeDsalEmail(input.personalEmail),
    p_comments: input.comments?.trim() ? normalizeDsalDisplayText(input.comments) : null
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible enviar la postulación.")
    };
  }

  return { data: data as { id: string; status: "received" }, error: null };
}

export async function fetchDsalRosterIdentity(nationalId: string) {
  if (!supabase) {
    return { data: null, error: "Supabase no está configurado en este entorno." };
  }

  const { data, error } = await supabase.rpc("get_dsal_roster_identity", {
    p_national_id: normalizeRut(nationalId)
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible validar el RUT en la nómina DSAL.")
    };
  }

  return { data: (data ?? { found: false }) as DsalRosterIdentity, error: null };
}

export async function fetchDsalPrecandidatesPage(input: {
  status?: DsalPrecandidateStatus | "all";
  search?: string;
  limit: number;
  offset: number;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("get_recruitment_precandidates_page", {
    p_status: input.status ?? "pending",
    p_search: input.search?.trim() ? input.search.trim() : null,
    p_limit: input.limit,
    p_offset: input.offset
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible cargar precandidatos.")
    };
  }

  return { data: parsePrecandidatesPage(data), error: null };
}

export async function approveDsalPrecandidate(input: {
  precandidateId: string;
  caseId: string;
}) {
  if (!supabase) {
    return {
      data: null,
      error: "Supabase no está configurado en este entorno."
    };
  }

  const { data, error } = await supabase.rpc("approve_recruitment_precandidate", {
    p_precandidate_id: input.precandidateId,
    p_case_id: input.caseId
  });

  if (error) {
    return {
      data: null,
      error: getSupabaseErrorMessage(error, "No fue posible aprobar el precandidato.")
    };
  }

  return {
    data: data as { case_candidate_id: string; candidate_profile_id: string },
    error: null
  };
}

export async function rejectDsalPrecandidate(input: {
  precandidateId: string;
}) {
  if (!supabase) {
    return { error: "Supabase no está configurado en este entorno." };
  }

  const { error } = await supabase.rpc("reject_recruitment_precandidate", {
    p_precandidate_id: input.precandidateId
  });

  if (error) {
    return {
      error: getSupabaseErrorMessage(error, "No fue posible rechazar el precandidato.")
    };
  }

  return { error: null };
}

export { formatRut };
