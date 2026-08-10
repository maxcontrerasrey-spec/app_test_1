import { supabase } from "../../../shared/lib/supabase";
import { formatRut, normalizeRut } from "../../../shared/lib/rut";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type PublicBukWorkerFileDraft = {
  gender: string;
  birthDate: string;
  nationality: string;
  maritalStatus: string;
  personalEmail: string;
  phone: string;
  streetName: string;
  streetNumber: string;
  apartmentOrOffice: string;
  districtOrCommune: string;
  currentCity: string;
  region: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  firefighterStatus: string;
  foreignWorker: string;
  shirtSize: string;
  pantsSize: string;
  shoeSize: string;
  paymentMethod: string;
  paymentPeriod: string;
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  pensionRegime: string;
  contributionFund: string;
  healthProvider: string;
  healthPlanUf: string;
  retiredStatus: string;
  retirementRegime: string;
};

export type PublicBukWorkerFileCandidate = Partial<PublicBukWorkerFileDraft> & Record<string, unknown> & {
  case_candidate_id: string;
  national_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  second_last_name: string | null;
  personal_email: string | null;
};

export type PublicBukWorkerFileSession = {
  session_token: string;
  expires_at: string;
  candidate: PublicBukWorkerFileCandidate;
};

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toDraft(candidate: PublicBukWorkerFileCandidate): PublicBukWorkerFileDraft {
  return {
    gender: text(candidate.gender),
    birthDate: text(candidate.birth_date),
    nationality: text(candidate.nationality),
    maritalStatus: text(candidate.marital_status),
    personalEmail: text(candidate.personal_email),
    phone: text(candidate.phone).replace(/^\+569/, "").replace(/\D/g, "").slice(-8),
    streetName: text(candidate.street_name || candidate.address_line),
    streetNumber: text(candidate.street_number),
    apartmentOrOffice: text(candidate.apartment_or_office),
    districtOrCommune: text(candidate.district_or_commune),
    currentCity: text(candidate.current_city),
    region: text(candidate.region),
    emergencyContactName: text(candidate.emergency_contact_name),
    emergencyContactPhone: text(candidate.emergency_contact_phone),
    emergencyContactRelationship: text(candidate.emergency_contact_relationship),
    firefighterStatus: text(candidate.firefighter_status) || "no_informa",
    foreignWorker: text(candidate.foreign_worker) || "No",
    shirtSize: text(candidate.shirt_size),
    pantsSize: text(candidate.pants_size),
    shoeSize: text(candidate.shoe_size),
    paymentMethod: text(candidate.payment_method),
    paymentPeriod: text(candidate.payment_period),
    bankName: text(candidate.bank_name),
    bankAccountType: text(candidate.bank_account_type),
    bankAccountNumber: text(candidate.bank_account_number),
    pensionRegime: text(candidate.pension_regime),
    contributionFund: text(candidate.contribution_fund),
    healthProvider: text(candidate.health_provider),
    healthPlanUf: candidate.health_plan_uf == null ? "" : String(candidate.health_plan_uf),
    retiredStatus: text(candidate.retired_status) || "No",
    retirementRegime: text(candidate.retirement_regime)
  };
}

export async function startPublicBukWorkerFile(nationalId: string, personalEmail: string) {
  if (!supabase) return { data: null, error: "Supabase no está configurado en este entorno." };

  const { data, error } = await supabase.rpc("start_public_dsal_buk_worker_file", {
    p_national_id: normalizeRut(nationalId),
    p_personal_email: personalEmail.trim().toLowerCase()
  });

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error, "No encontramos un candidato DSAL aprobado con esos datos.") };
  }

  const session = data as PublicBukWorkerFileSession;
  return {
    data: {
      ...session,
      candidate: {
        ...session.candidate,
        national_id: formatRut(session.candidate.national_id),
        draft: toDraft(session.candidate)
      }
    },
    error: null
  };
}

export async function submitPublicBukWorkerFile(
  sessionToken: string,
  draft: PublicBukWorkerFileDraft
) {
  if (!supabase) return { data: null, error: "Supabase no está configurado en este entorno." };

  const payload = {
    gender: draft.gender,
    birth_date: draft.birthDate,
    nationality: draft.nationality,
    marital_status: draft.maritalStatus,
    personal_email: draft.personalEmail.trim().toLowerCase(),
    phone: draft.phone.replace(/\D/g, ""),
    street_name: draft.streetName,
    street_number: draft.streetNumber,
    apartment_or_office: draft.apartmentOrOffice,
    district_or_commune: draft.districtOrCommune,
    current_city: draft.currentCity,
    region: draft.region,
    emergency_contact_name: draft.emergencyContactName,
    emergency_contact_phone: draft.emergencyContactPhone,
    emergency_contact_relationship: draft.emergencyContactRelationship,
    firefighter_status: draft.firefighterStatus,
    foreign_worker: draft.foreignWorker,
    shirt_size: draft.shirtSize,
    pants_size: draft.pantsSize,
    shoe_size: draft.shoeSize,
    payment_method: draft.paymentMethod,
    payment_period: draft.paymentPeriod,
    bank_name: draft.bankName,
    bank_account_type: draft.bankAccountType,
    bank_account_number: draft.bankAccountNumber,
    pension_regime: draft.pensionRegime,
    contribution_fund: draft.contributionFund,
    health_provider: draft.healthProvider,
    health_plan_uf: draft.healthPlanUf,
    retired_status: draft.retiredStatus,
    retirement_regime: draft.retirementRegime
  };

  const { data, error } = await supabase.rpc("submit_public_dsal_buk_worker_file", {
    p_session_token: sessionToken,
    p_payload: payload
  });

  return {
    data: error ? null : data,
    error: error
      ? getSupabaseErrorMessage(error, "No fue posible guardar la ficha BUK.")
      : null
  };
}
