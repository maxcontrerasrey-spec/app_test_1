import { supabase } from "../../../shared/lib/supabase";
import { getSupabaseErrorMessage } from "../../../shared/lib/supabaseRpc";

export type RentStructureContract = {
  id: number;
  code: string;
  contractNumber: string;
  contractName: string;
};

export type RentStructurePosition = {
  id: number;
  code: string;
  name: string;
  hasStructure: boolean;
  authorizedHeadcount: number;
  monthlyBudget: number | null;
  currencyCode: string;
  contractedCount: number;
  presentEquivalent: number;
  balance: number | null;
  coverage: number | null;
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
  ufMonthEndClp: number | null;
  pensionHealthCapUf: number | null;
  unemploymentCapUf: number | null;
};

export type RentLegalCatalog = {
  afps: Array<{ code: string; name: string; commissionRate: number }>;
  indicator: { periodMonth: string; ufMonthEndClp: number; pensionHealthCapUf: number; unemploymentCapUf: number } | null;
};

export type RentStructureDetail = {
  id: string;
  jobPositionId: number;
  monthlyBudget: number | null;
  authorizedHeadcount: number;
  currencyCode: string;
  calculationAvailable: boolean;
  legalScenario: RentLegalScenario;
  lines: RentStructureLine[];
  totals: { imponible: number; noImponible: number; haberes: number; legalDiscounts: number | null; liquidoEstimated: number | null };
  legalAssumptions: string[];
} | null;

export type RentStructureControlPayload = {
  contracts: RentStructureContract[];
  positions: RentStructurePosition[];
  structure: RentStructureDetail;
  canConfigure: boolean;
  month: string;
  legalCatalog: RentLegalCatalog;
};

type RawPayload = {
  contracts?: Array<{ id: number; code: string; contract_number: string; contract_name: string }>;
  positions?: Array<{ id: number; code: string; name: string; has_structure: boolean; authorized_headcount: number; monthly_budget: number | null; currency_code: string; contracted_count: number; present_equivalent: number; balance: number; coverage: number | null }>;
  legal_catalog?: { afps?: Array<{ code: string; name: string; commission_rate: number }>; indicator?: { period_month: string; uf_month_end_clp: number; pension_health_cap_uf: number; unemployment_cap_uf: number } | null };
  structure?: { id: string; job_position_id: number; authorized_headcount: number; monthly_budget: number | null; currency_code: string; calculation_available?: boolean; legal_scenario?: { afp_code: string; afp_name: string; afp_commission_rate: number | null; health_mode: RentLegalScenario["healthMode"]; health_provider_name: string; health_plan_value: number; unemployment_contract_type: RentLegalScenario["unemploymentContractType"]; uf_month_end_clp: number | null; pension_health_cap_uf: number | null; unemployment_cap_uf: number | null }; lines?: Array<{ id: string; concept_code: string; concept_name: string; concept_type: string; section_code: string; calculation_mode: string; amount: number; detail?: string; sort_order: number }>; totals?: { imponible: number; no_imponible: number; haberes: number; legal_discounts: number | null; liquido_estimated: number | null }; legal_assumptions?: string[] };
  can_configure?: boolean;
  month?: string;
};

export async function fetchRentStructureControl(contractId: number | null, jobPositionId: number | null, month?: string) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");

  const { data, error } = await supabase.rpc("get_hr_rent_structure_control", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId,
    p_month: month ? `${month}-01` : null
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
      contractedCount: row.contracted_count ?? 0,
      presentEquivalent: row.present_equivalent ?? 0,
      balance: row.balance ?? 0,
      coverage: row.coverage ?? null
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
            ufMonthEndClp: payload.structure.legal_scenario?.uf_month_end_clp ?? null,
            pensionHealthCapUf: payload.structure.legal_scenario?.pension_health_cap_uf ?? null,
            unemploymentCapUf: payload.structure.legal_scenario?.unemployment_cap_uf ?? null
          },
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
            legalDiscounts: payload.structure.totals?.legal_discounts ?? null,
            liquidoEstimated: payload.structure.totals?.liquido_estimated ?? null
          },
          legalAssumptions: payload.structure.legal_assumptions ?? []
        }
      : null,
    canConfigure: payload.can_configure ?? false,
    month: payload.month ?? month ?? "",
    legalCatalog: {
      afps: (payload.legal_catalog?.afps ?? []).map((afp) => ({ code: afp.code, name: afp.name, commissionRate: afp.commission_rate })),
      indicator: payload.legal_catalog?.indicator ? {
        periodMonth: payload.legal_catalog.indicator.period_month,
        ufMonthEndClp: payload.legal_catalog.indicator.uf_month_end_clp,
        pensionHealthCapUf: payload.legal_catalog.indicator.pension_health_cap_uf,
        unemploymentCapUf: payload.legal_catalog.indicator.unemployment_cap_uf
      } : null
    }
  } satisfies RentStructureControlPayload;
}

export type RentStructureConfigLine = Pick<RentStructureLine, "conceptCode" | "conceptName" | "amount" | "sortOrder"> & { sectionCode: "imponible" | "no_imponible" };

export type RentStructureLegalConfig = Pick<RentLegalScenario, "afpCode" | "healthMode" | "healthProviderName" | "healthPlanValue" | "unemploymentContractType">;

export async function saveRentStructureConfig(contractId: number, jobPositionId: number, authorizedHeadcount: number, lines: RentStructureConfigLine[], legal: RentStructureLegalConfig) {
  if (!supabase) throw new Error("Supabase no está configurado en este entorno.");
  const { data, error } = await supabase.rpc("save_hr_rent_structure_config", {
    p_contract_id: contractId,
    p_job_position_id: jobPositionId,
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
    p_unemployment_contract_type: legal.unemploymentContractType
  });
  if (error) throw new Error(getSupabaseErrorMessage(error, "No fue posible guardar la estructura de renta.", "message"));
  return String(data);
}
