import type { BiRecruitmentDashboard } from "../types";

export type FilledVacancyView = "total" | "hired" | "mobility";
export type RequestedVacancyView = "total" | "pending";
export type IncorporationPaceView = "daily" | "weekly" | "monthly" | "semester";

export const CANDIDATE_STAGE_ORDER = [
  "Lead",
  "Who pendiente",
  "Who aprobado",
  "En proceso",
  "Exámenes médicos",
  "Levantamiento de Contraindicación",
  "Revisión documental",
  "Listos para contratar"
];

export const CANDIDATE_STAGE_ORDER_INDEX = new Map(
  CANDIDATE_STAGE_ORDER.map((stage, index) => [stage, index])
);

// "Levantamiento de Contraindicación" es una rama opcional desde
// "Exámenes médicos" (no todos los candidatos la atraviesan), por lo que
// el pipeline no es un funnel estrictamente decreciente. Se conserva el
// orden operacional para las barras, pero no se calcula "conversión desde
// la etapa anterior" para evitar una caída falsa en esa etapa.
export const CANDIDATE_STAGE_OPTIONAL_BRANCHES = new Set([
  "Levantamiento de Contraindicación"
]);

export const RECRUITMENT_DONUT_CHART_STYLE = {
  radius: ["50%", "75%"],
  center: ["50%", "45%"],
  padAngle: 3,
  labelMaxLength: 16,
  shadowColor: "rgba(0, 0, 0, 0.08)"
} as const;

export const INCORPORATION_PACE_VIEW_OPTIONS: Array<{
  key: IncorporationPaceView;
  label: string;
  shortLabel: string;
}> = [
  { key: "daily", label: "Diaria", shortLabel: "D" },
  { key: "weekly", label: "Semanal", shortLabel: "S" },
  { key: "monthly", label: "Mensual", shortLabel: "M" },
  { key: "semester", label: "Semestral", shortLabel: "6M" }
];

export type BiChartPalette = {
  requested: string;
  covered: string;
  missingVacancies: string;
  folios: string;
  hired: string;
  mobility: string;
  mobilityPendingControl: string;
  ready: string;
  pending: string;
  rejected: string;
  partial: string;
  screening: string;
  open: string;
  neutral: string;
  stage: string[];
};

export const BI_CHART_PALETTES: Record<"light" | "dark" | "e-ink", BiChartPalette> = {
  light: {
    requested: "#94a3b8",
    covered: "#178463",
    missingVacancies: "#b95a4f",
    folios: "#2563eb",
    hired: "#0f766e",
    mobility: "#7c3aed",
    mobilityPendingControl: "#4f46e5",
    ready: "#b45309",
    pending: "#d97706",
    rejected: "#a83b3b",
    partial: "#c2410c",
    screening: "#64748b",
    open: "#2563eb",
    neutral: "#64748b",
    stage: ["#475569", "#d97706", "#0f766e", "#2563eb", "#0891b2", "#a855f7", "#7c3aed", "#178463"]
  },
  dark: {
    requested: "#64748b",
    covered: "#5eead4",
    missingVacancies: "#f87171",
    folios: "#60a5fa",
    hired: "#34d399",
    mobility: "#c4b5fd",
    mobilityPendingControl: "#818cf8",
    ready: "#fbbf24",
    pending: "#f59e0b",
    rejected: "#fca5a5",
    partial: "#fb923c",
    screening: "#94a3b8",
    open: "#60a5fa",
    neutral: "#94a3b8",
    stage: ["#94a3b8", "#f59e0b", "#34d399", "#60a5fa", "#22d3ee", "#d8b4fe", "#c4b5fd", "#5eead4"]
  },
  "e-ink": {
    requested: "#8c8679",
    covered: "#4a6b52",
    missingVacancies: "#8a4b46",
    folios: "#355f75",
    hired: "#4a6b52",
    mobility: "#6a5a78",
    mobilityPendingControl: "#515b78",
    ready: "#8a6a2a",
    pending: "#8a6a2a",
    rejected: "#8a3a3a",
    partial: "#8a4f2a",
    screening: "#6b665d",
    open: "#355f75",
    neutral: "#6b665d",
    stage: ["#6b665d", "#8a6a2a", "#4a6b52", "#355f75", "#4f6f75", "#7a5f82", "#6a5a78", "#4a634e"]
  }
};

export function formatMetricValue(value: number) {
  return value.toLocaleString("es-CL");
}

export function formatPercentValue(value: number) {
  return `${value.toLocaleString("es-CL", {
    maximumFractionDigits: value >= 10 ? 0 : 1
  })}%`;
}

export function truncateRecruitmentChartLabel(value: string, maxLength: number = RECRUITMENT_DONUT_CHART_STYLE.labelMaxLength) {
  if (!value) return "";
  return value.length > maxLength ? `${value.substring(0, maxLength)}…` : value;
}

export type VacancyCoverage = {
  requested: number;
  filled: number;
  missing: number;
  coveragePct: number;
};

// Cobertura = cupos cubiertos / cupos solicitados. Mismo denominador que
// usan las tarjetas superiores (summary del RPC filtrado), para que
// tarjeta y gráfico nunca diverjan (lección #281).
export function computeVacancyCoverage(requested: number, filled: number): VacancyCoverage {
  const safeRequested = Math.max(requested, 0);
  const safeFilled = Math.max(filled, 0);
  const missing = Math.max(safeRequested - safeFilled, 0);
  const coveragePct = safeRequested > 0 ? (safeFilled / safeRequested) * 100 : 0;

  return { requested: safeRequested, filled: safeFilled, missing, coveragePct };
}

export type VacancyGapRow = VacancyCoverage & { label: string };

export function buildVacancyGapRows(
  vacanciesByContract: BiRecruitmentDashboard["vacanciesByContract"]
): VacancyGapRow[] {
  return vacanciesByContract
    .map((item) => ({ label: item.label, ...computeVacancyCoverage(item.requested, item.filled) }))
    .sort((left, right) => right.missing - left.missing || right.requested - left.requested);
}

export function getCaseStatusColor(label: string, palette: BiChartPalette) {
  const normalized = label.toLowerCase();

  if (normalized.includes("abierto")) return palette.open;
  if (normalized.includes("screen")) return palette.screening;
  if (normalized.includes("parcial")) return palette.partial;
  if (normalized.includes("cerr") || normalized.includes("cancel") || normalized.includes("rech")) {
    return palette.neutral;
  }

  return palette.mobility;
}

export function getMobilityStatusColor(label: string, palette: BiChartPalette) {
  const normalized = label.toLowerCase();

  if (normalized.includes("ejecut")) return palette.hired;
  if (normalized.includes("control")) return palette.mobilityPendingControl;
  if (normalized.includes("pend")) return palette.mobility;
  if (normalized.includes("rech")) return palette.rejected;

  return palette.neutral;
}

function toMonthLabel(value: string) {
  if (!value) return "Mes";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    month: "short",
    year: "2-digit"
  })
    .format(date)
    .replace(".", "");
}

function toDayLabel(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

// El RPC genera un bucket por cada dia del mes del periodo consultado,
// incluyendo dias que todavia no ocurren cuando el periodo es el actual.
// Un COUNT(*) sobre un dia futuro siempre devuelve 0 (no hay forma de que
// SQL distinga "cero eventos" de "el dia no ha pasado"), asi que el corte
// debe hacerse en el cliente comparando contra la fecha real del navegador.
export function isFutureBucketDate(bucketStart: string, referenceDate: Date = new Date()): boolean {
  if (!bucketStart) return false;

  const bucketDate = new Date(`${bucketStart}T00:00:00`);
  if (Number.isNaN(bucketDate.getTime())) return false;

  const todayStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  return bucketDate.getTime() > todayStart.getTime();
}

export type BiIncorporationPacePoint = {
  bucketStart: string;
  bucketLabel: string;
  hiredCandidates: number;
  executedMobilities: number;
  totalIncorporations: number;
};

type IncorporationBucketAccumulator = {
  bucketStart: string;
  bucketLabel: string;
  hiredCandidates: number;
  executedMobilities: number;
};

/**
 * Construye la serie de Ritmo de Incorporación: personas realmente
 * incorporadas por período, desglosadas en contrataciones (hiredCandidates)
 * y movilidad interna ejecutada (executedMobilities) -- ambos ya cuentan
 * personas, no folios ni solicitudes, por lo que son sumables entre sí.
 *
 * Los buckets futuros (fecha > hoy) se excluyen antes de agrupar, en vez
 * de dejarlos en cero, para no dibujar una caída artificial al final de
 * la serie (mismo criterio que isFutureBucketDate ya usado en Reclutamiento).
 */
export function buildIncorporationPaceSeries(
  timeline: BiRecruitmentDashboard["timeline"],
  view: IncorporationPaceView,
  referenceDate: Date = new Date()
): BiIncorporationPacePoint[] {
  const observedDaily = timeline
    .filter((item) => !isFutureBucketDate(item.bucketStart, referenceDate))
    .map((item) => ({
      bucketStart: item.bucketStart,
      hiredCandidates: item.hiredCandidates,
      executedMobilities: item.executedMobilities
    }));

  if (observedDaily.length === 0) {
    return [];
  }

  let grouped: IncorporationBucketAccumulator[];

  if (view === "daily") {
    grouped = observedDaily.map((item) => ({
      bucketStart: item.bucketStart,
      bucketLabel: toDayLabel(item.bucketStart),
      hiredCandidates: item.hiredCandidates,
      executedMobilities: item.executedMobilities
    }));
  } else if (view === "weekly") {
    const firstDate = new Date(`${observedDaily[0].bucketStart}T00:00:00`);

    if (observedDaily.length <= 6 || Number.isNaN(firstDate.getTime())) {
      grouped = observedDaily.map((item) => ({
        bucketStart: item.bucketStart,
        bucketLabel: toDayLabel(item.bucketStart),
        hiredCandidates: item.hiredCandidates,
        executedMobilities: item.executedMobilities
      }));
    } else {
      const groups = new Map<number, IncorporationBucketAccumulator>();

      observedDaily.forEach((item) => {
        const currentDate = new Date(`${item.bucketStart}T00:00:00`);
        const weekIndex = Number.isNaN(currentDate.getTime())
          ? 0
          : Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const current = groups.get(weekIndex);

        if (current) {
          current.hiredCandidates += item.hiredCandidates;
          current.executedMobilities += item.executedMobilities;
          return;
        }

        groups.set(weekIndex, {
          bucketStart: item.bucketStart,
          bucketLabel: toDayLabel(item.bucketStart),
          hiredCandidates: item.hiredCandidates,
          executedMobilities: item.executedMobilities
        });
      });

      grouped = Array.from(groups.values());
    }
  } else if (view === "monthly") {
    const totals = observedDaily.reduce(
      (accumulator, item) => ({
        hiredCandidates: accumulator.hiredCandidates + item.hiredCandidates,
        executedMobilities: accumulator.executedMobilities + item.executedMobilities
      }),
      { hiredCandidates: 0, executedMobilities: 0 }
    );

    grouped = [
      {
        bucketStart: observedDaily[0].bucketStart,
        bucketLabel: toMonthLabel(observedDaily[0].bucketStart),
        ...totals
      }
    ];
  } else {
    const groups = new Map<string, IncorporationBucketAccumulator>();

    observedDaily.forEach((item) => {
      const monthKey = item.bucketStart.slice(0, 7) || item.bucketStart;
      const current = groups.get(monthKey);

      if (current) {
        current.hiredCandidates += item.hiredCandidates;
        current.executedMobilities += item.executedMobilities;
        return;
      }

      groups.set(monthKey, {
        bucketStart: item.bucketStart,
        bucketLabel: toMonthLabel(item.bucketStart),
        hiredCandidates: item.hiredCandidates,
        executedMobilities: item.executedMobilities
      });
    });

    grouped = Array.from(groups.values()).slice(-6);
  }

  return grouped.map((bucket) => ({
    ...bucket,
    totalIncorporations: bucket.hiredCandidates + bucket.executedMobilities
  }));
}
