import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type RentStructureContract = {
  id: number;
  code: string;
  contractNumber: string;
  contractName: string;
};

export type RentShift = { id: number; name: string };

export type RentStructureVariant = {
  id: string;
  shiftId: number | null;
  shiftName: string | null;
  legalRegimeCode: "art_25" | "ordinario" | null;
  authorizedHeadcount: number;
};

export type RentStructurePosition = {
  id: number;
  code: string;
  name: string;
  hasStructure: boolean;
  authorizedHeadcount: number;
  monthlyBudget: number | null;
  currencyCode: string;
  structures: RentStructureVariant[];
  applicableShiftIds: number[];
};

export type RentStructureLine = {
  id: string;
  conceptCode: string;
  conceptName: string;
  conceptType: string;
  sectionCode: string;
  calculationMode: string;
  amount: number;
  detail?: string;
  sortOrder: number;
};

export type RentLegalScenario = {
  afpCode: string;
  afpName: string;
  afpCommissionRate: number | null;
  healthMode: "fonasa" | "isapre_uf" | "isapre_pesos" | "isapre_percentage";
  healthProviderName: string;
  healthPlanValue: number;
  unemploymentContractType: "indefinite" | "fixed_term";
  includeIncomeTax: boolean;
  iuscUtmClp: number | null;
};

export type RentLegalCatalog = {
  afps: Array<{ code: string; name: string; commissionRate: number }>;
};

export type RentStructureDetail = {
  id: string;
  jobPositionId: number;
  monthlyBudget: number | null;
  authorizedHeadcount: number;
  currencyCode: string;
  calculationAvailable: boolean;
  legalScenario: RentLegalScenario;
  shiftIds: number[];
  shiftId: number | null;
  shiftName: string | null;
  legalRegimeCode: "art_25" | "ordinario" | null;
  shiftClassificationPending: boolean;
  lines: RentStructureLine[];
  totals: {
    imponible: number;
    noImponible: number;
    haberes: number;
    pensionHealthBase: number;
    unemploymentBase: number;
    taxableBase: number | null;
    incomeTax: number | null;
    legalDiscounts: number | null;
    liquidoEstimated: number | null;
    authorizedPayroll: number;
  };
  legalAssumptions: string[];
} | null;

export type RentStructureControlPayload = {
  contracts: RentStructureContract[];
  positions: RentStructurePosition[];
  structure: RentStructureDetail;
  canConfigure: boolean;
  legalCatalog: RentLegalCatalog;
  shiftCatalog: RentShift[];
};

type RawPayload = {
  contracts?: Array<{ id: number; code: string; contract_number: string; contract_name: string }>;
  positions?: Array<{ id: number; code: string; name: string; has_structure: boolean; authorized_headcount: number; monthly_budget: number | null; currency_code: string; applicable_shift_ids?: number[]; structure_variants?: Array<{ id: string; shift_id: number | null; shift_name: string | null; legal_regime_code: "art_25" | "ordinario" | null; authorized_headcount: number }> }>;
  legal_catalog?: { afps?: Array<{ code: string; name: string; commission_rate: number }> };
  shift_catalog?: RentShift[];
  structure?: { id: string; job_position_id: number; authorized_headcount: number; monthly_budget: number | null; currency_code: string; shift_ids?: number[]; shift_id?: number | null; shift_name?: string | null; legal_regime_code?: "art_25" | "ordinario" | null; shift_classification_pending?: boolean; calculation_available?: boolean; legal_scenario?: { afp_code: string; afp_name: string; afp_commission_rate: number | null; health_mode: RentLegalScenario["healthMode"]; health_provider_name: string; health_plan_value: number; unemployment_contract_type: RentLegalScenario["unemploymentContractType"]; include_income_tax?: boolean; iusc_utm_clp?: number | null }; lines?: Array<{ id: string; concept_code: string; concept_name: string; concept_type: string; section_code: string; calculation_mode: string; amount: number; detail?: string; sort_order: number }>; totals?: { imponible: number; no_imponible: number; haberes: number; pension_health_base: number; unemployment_base: number; taxable_base?: number | null; income_tax?: number | null; legal_discounts: number | null; liquido_estimated: number; authorized_payroll: number }; legal_assumptions?: string[] };
  can_configure?: boolean;
};

export async function fetchRentStructureControl(contractId: number | null, jobPositionId: number | null, shiftId: number | null, structureId: string | null) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");

  const { data, error } = await supabase.rpc("get_hr_rent_structure_variant_control", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId,
    p_shift_id: shiftId,
    p_structure_id: structureId
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "No fue posible cargar el control de estructuras de renta.", "message"));
  }

  const payload = (data ?? {}) as RawPayload;
  return {
    contracts: (payload.contracts ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      contractNumber: row.contract_number,
      contractName: row.contract_name
    })),
    positions: (payload.positions ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      hasStructure: row.has_structure,
      authorizedHeadcount: row.authorized_headcount ?? 0,
      monthlyBudget: row.monthly_budget,
      currencyCode: row.currency_code,
      applicableShiftIds: row.applicable_shift_ids ?? [],
      structures: (row.structure_variants ?? []).map((variant) => ({
        id: variant.id,
        shiftId: variant.shift_id,
        shiftName: variant.shift_name,
        legalRegimeCode: variant.legal_regime_code,
        authorizedHeadcount: variant.authorized_headcount
      }))
    })),
    structure: payload.structure?.id
      ? {
          id: payload.structure.id,
          jobPositionId: payload.structure.job_position_id,
          authorizedHeadcount: payload.structure.authorized_headcount ?? 0,
          monthlyBudget: payload.structure.monthly_budget,
          currencyCode: payload.structure.currency_code,
          calculationAvailable: payload.structure.calculation_available ?? false,
          legalScenario: {
            afpCode: payload.structure.legal_scenario?.afp_code ?? "habitat",
            afpName: payload.structure.legal_scenario?.afp_name ?? "AFP Habitat",
            afpCommissionRate: payload.structure.legal_scenario?.afp_commission_rate ?? null,
            healthMode: payload.structure.legal_scenario?.health_mode ?? "fonasa",
            healthProviderName: payload.structure.legal_scenario?.health_provider_name ?? "Fonasa",
            healthPlanValue: payload.structure.legal_scenario?.health_plan_value ?? 0,
            unemploymentContractType: payload.structure.legal_scenario?.unemployment_contract_type ?? "indefinite",
            includeIncomeTax: payload.structure.legal_scenario?.include_income_tax ?? false,
            iuscUtmClp: payload.structure.legal_scenario?.iusc_utm_clp ?? null
          },
          shiftIds: payload.structure.shift_ids ?? [],
          shiftId: payload.structure.shift_id ?? null,
          shiftName: payload.structure.shift_name ?? null,
          legalRegimeCode: payload.structure.legal_regime_code ?? null,
          shiftClassificationPending: payload.structure.shift_classification_pending ?? true,
          lines: (payload.structure.lines ?? []).map((line) => ({
            id: line.id,
            conceptCode: line.concept_code,
            conceptName: line.concept_name,
            conceptType: line.concept_type,
            sectionCode: line.section_code,
            calculationMode: line.calculation_mode,
            amount: line.amount,
            detail: line.detail,
            sortOrder: line.sort_order
          })),
          totals: {
            imponible: payload.structure.totals?.imponible ?? 0,
            noImponible: payload.structure.totals?.no_imponible ?? 0,
            haberes: payload.structure.totals?.haberes ?? 0,
            pensionHealthBase: payload.structure.totals?.pension_health_base ?? 0,
            unemploymentBase: payload.structure.totals?.unemployment_base ?? 0,
            taxableBase: payload.structure.totals?.taxable_base ?? null,
            incomeTax: payload.structure.totals?.income_tax ?? null,
            legalDiscounts: payload.structure.totals?.legal_discounts ?? null,
            liquidoEstimated: payload.structure.totals?.liquido_estimated ?? null,
            authorizedPayroll: payload.structure.totals?.authorized_payroll ?? 0
          },
          legalAssumptions: payload.structure.legal_assumptions ?? []
        }
      : null,
    canConfigure: payload.can_configure ?? false,
    legalCatalog: {
      afps: (payload.legal_catalog?.afps ?? []).map((afp) => ({ code: afp.code, name: afp.name, commissionRate: afp.commission_rate }))
    },
    shiftCatalog: payload.shift_catalog ?? []
  } satisfies RentStructureControlPayload;
}

export type RentStructureConfigLine = Pick<RentStructureLine, "conceptCode" | "conceptName" | "amount" | "sortOrder"> & { sectionCode: "imponible" | "no_imponible" };

export type RentStructureLegalConfig = Pick<RentLegalScenario, "afpCode" | "healthMode" | "healthProviderName" | "healthPlanValue" | "unemploymentContractType" | "includeIncomeTax">;
export type RentRegimeCode = "art_25" | "ordinario";

export async function saveRentStructureConfig(contractId: number, jobPositionId: number, structureId: string | null, shiftId: number, authorizedHeadcount: number, lines: RentStructureConfigLine[], legal: RentStructureLegalConfig, legalRegimeCode: RentRegimeCode | null) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.rpc("save_hr_rent_structure_variant", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId,
    p_structure_id: structureId,
    p_shift_id: shiftId,
    p_authorized_headcount: authorizedHeadcount,
    p_lines: lines.map((line) => ({
      concept_code: line.conceptCode,
      concept_name: line.conceptName,
      section_code: line.sectionCode,
      amount: line.amount,
      sort_order: line.sortOrder
    })),
    p_afp_code: legal.afpCode,
    p_health_mode: legal.healthMode,
    p_health_provider_name: legal.healthProviderName,
    p_health_plan_value: legal.healthPlanValue,
    p_unemployment_contract_type: legal.unemploymentContractType,
    p_include_income_tax: legal.includeIncomeTax,
    p_legal_regime_code: legalRegimeCode
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible guardar la estructura de renta.", "message"));
  return String(data);
}

export async function saveRentPositionShifts(contractId: number, jobPositionId: number, shiftIds: number[]) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  const { error } = await supabase.rpc("save_hr_rent_position_shifts", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId,
    p_shift_ids: shiftIds
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible guardar las jornadas aplicables.", "message"));
}
