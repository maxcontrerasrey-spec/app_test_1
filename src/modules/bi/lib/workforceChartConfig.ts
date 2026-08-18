import type { BukBiExceptionsMonthly } from "../types";
import { formatMetricValue, formatPercentValue } from "./recruitmentAnalyticsChartConfig";

export { formatMetricValue, formatPercentValue };

export type WorkforcePalette = {
  presence: string;
  vacation: string;
  medicalLeave: string;
  otherAbsence: string;
  volume: string;
  neutral: string;
  track: string;
};

// Semántica compartida en toda la vista de Dotación (sección 12 del brief):
// presencia=verde, vacaciones=azul, licencias médicas=rojo, otras
// ausencias=naranjo, volumen/dotación=azul neutral o gris según contexto.
export const WORKFORCE_PALETTE: Record<"light" | "dark" | "e-ink", WorkforcePalette> = {
  light: {
    presence: "#178463",
    vacation: "#2563eb",
    medicalLeave: "#b3423a",
    otherAbsence: "#d97706",
    volume: "#2563eb",
    neutral: "#64748b",
    track: "rgba(148, 163, 184, 0.22)"
  },
  dark: {
    presence: "#34d399",
    vacation: "#60a5fa",
    medicalLeave: "#fca5a5",
    otherAbsence: "#fbbf24",
    volume: "#60a5fa",
    neutral: "#94a3b8",
    track: "rgba(148, 163, 184, 0.16)"
  },
  "e-ink": {
    presence: "#4a6b52",
    vacation: "#355f75",
    medicalLeave: "#8a3a3a",
    otherAbsence: "#8a6a2a",
    volume: "#355f75",
    neutral: "#6b665d",
    track: "rgba(107, 102, 93, 0.2)"
  }
};

export type RankedShareRow = {
  label: string;
  value: number;
  pct: number;
};

/** Convierte un mapa label->cantidad en filas ordenadas desc con % del total. */
export function buildRankedShareRows(values: Map<string, number>): RankedShareRow[] {
  const total = Array.from(values.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(values.entries())
    .map(([label, value]) => ({ label, value, pct: total > 0 ? (value / total) * 100 : 0 }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "es-CL"));
}

// Mapeo de stage_code crudo -> etiqueta humana, replicando exactamente el
// CASE de `get_bi_recruitment_dashboard` (candidates_by_stage) porque
// `get_bi_recruitment_pipeline` no lo hace SQL-side. No inventa etapas
// nuevas; solo humaniza el mismo dominio de valores reales.
const PIPELINE_STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  who_pending: "Who pendiente",
  who_approved: "Who aprobado",
  in_process: "En proceso",
  medical_exams: "Exámenes médicos",
  medical_contraindication_resolution: "Levantamiento de Contraindicación",
  document_review: "Revisión documental",
  ready_for_hire: "Listos para contratar"
};

// Etapas terminales: no son "pipeline en curso", son desenlaces.
export const PIPELINE_TERMINAL_STAGES = new Set(["hired", "rejected", "withdrawn"]);

export function mapPipelineStageLabel(stageCode: string): string {
  return PIPELINE_STAGE_LABELS[stageCode] ?? stageCode;
}

export type AbsenteeismByContractRow = {
  contractCode: string;
  label: string;
  absenteeismPct: number;
  presentToday: number;
  absentToday: number;
  headcount: number;
};

export function buildAbsenteeismByContractRows(
  presenceRows: Array<{ contractCode: string; headcount: number; absentToday: number; presentToday: number; presencePct: number }>,
  labelByContractCode: Map<string, string>
): AbsenteeismByContractRow[] {
  return presenceRows
    .filter((row) => row.headcount > 0)
    .map((row) => ({
      contractCode: row.contractCode,
      label: labelByContractCode.get(row.contractCode) ?? row.contractCode,
      absenteeismPct: Math.max(0, 100 - row.presencePct),
      presentToday: row.presentToday,
      absentToday: row.absentToday,
      headcount: row.headcount
    }))
    .sort((left, right) => right.absenteeismPct - left.absenteeismPct);
}

export type AbsenteeismTrendPoint = {
  periodCode: string;
  monthLabel: string;
  vacationDays: number;
  medicalLeaveDays: number;
  otherAbsenceDays: number;
  totalDays: number;
  absenteeismPct: number | null;
};

const OTHER_ABSENCE_TYPES = new Set(["absent", "administrative_leave", "union_leave"]);

function toMonthLabel(periodCode: string) {
  if (!/^\d{6}$/.test(periodCode)) return periodCode;
  const year = periodCode.slice(0, 4);
  const month = periodCode.slice(4, 6);
  const date = new Date(`${year}-${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return periodCode;
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "2-digit" }).format(date).replace(".", "");
}

/**
 * Combina las respuestas de `get_bi_exceptions_monthly` para varios
 * periodos (una llamada por mes, porque el RPC solo soporta un periodo a
 * la vez) en una única serie mensual real.
 *
 * El absenteeismPct se deriva sumando fteHeadcountEquivalent y
 * headcountBase entre los contratos filtrados de ese mes (no se promedia
 * ni se copia el valor de una sola fila), porque cada fila del RPC repite
 * el mismo absenteeism_pct por contrato para todas sus filas de tipo de
 * excepción -- tomar una sola fila cuando hay más de un contrato filtrado
 * ignoraría al resto.
 */
export function mergeAbsenteeismTrend(
  periodCodes: string[],
  rowsByPeriod: Map<string, BukBiExceptionsMonthly[]>
): AbsenteeismTrendPoint[] {
  return periodCodes.map((periodCode) => {
    const rows = rowsByPeriod.get(periodCode) ?? [];

    let vacationDays = 0;
    let medicalLeaveDays = 0;
    let otherAbsenceDays = 0;
    const fteByContract = new Map<string, number>();
    const baseByContract = new Map<string, number>();

    rows.forEach((row) => {
      if (row.exceptionType === "vacation") vacationDays += row.totalDays;
      else if (row.exceptionType === "medical_leave") medicalLeaveDays += row.totalDays;
      else if (OTHER_ABSENCE_TYPES.has(row.exceptionType)) otherAbsenceDays += row.totalDays;

      if (!fteByContract.has(row.contractCode)) {
        fteByContract.set(row.contractCode, row.fteHeadcountEquivalent);
        baseByContract.set(row.contractCode, row.headcountBase);
      }
    });

    const sumFte = Array.from(fteByContract.values()).reduce((sum, value) => sum + value, 0);
    const sumBase = Array.from(baseByContract.values()).reduce((sum, value) => sum + value, 0);
    const absenteeismPct = sumBase > 0 ? Math.max(0, (1 - sumFte / sumBase) * 100) : null;

    return {
      periodCode,
      monthLabel: toMonthLabel(periodCode),
      vacationDays,
      medicalLeaveDays,
      otherAbsenceDays,
      totalDays: vacationDays + medicalLeaveDays + otherAbsenceDays,
      absenteeismPct
    };
  });
}

/** Últimos `count` períodos YYYYMM terminando en el mes actual (cliente). */
export function buildRecentPeriodCodes(count: number, referenceDate: Date = new Date()): string[] {
  const codes: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    codes.push(`${year}${month}`);
  }
  return codes;
}
