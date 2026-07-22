import type { BiRecruitmentDashboard } from "../types";

export type FilledVacancyView = "total" | "hired" | "mobility";
export type RequestedVacancyView = "total" | "pending";
export type OperationalPulseView = "daily" | "weekly" | "monthly" | "semester";

export const CANDIDATE_STAGE_ORDER = [
  "Lead",
  "Who pendiente",
  "Who aprobado",
  "En proceso",
  "Exámenes médicos",
  "Revisión documental",
  "Listos para contratar"
];

export const CANDIDATE_STAGE_ORDER_INDEX = new Map(
  CANDIDATE_STAGE_ORDER.map((stage, index) => [stage, index])
);

export const OPERATIONAL_PULSE_VIEW_OPTIONS: Array<{
  key: OperationalPulseView;
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
  folios: string;
  hired: string;
  mobility: string;
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
    folios: "#2563eb",
    hired: "#0f766e",
    mobility: "#7c3aed",
    ready: "#b45309",
    pending: "#d97706",
    rejected: "#a83b3b",
    partial: "#c2410c",
    screening: "#64748b",
    open: "#2563eb",
    neutral: "#64748b",
    stage: ["#475569", "#d97706", "#0f766e", "#2563eb", "#0891b2", "#7c3aed", "#178463"]
  },
  dark: {
    requested: "#64748b",
    covered: "#5eead4",
    folios: "#60a5fa",
    hired: "#34d399",
    mobility: "#c4b5fd",
    ready: "#fbbf24",
    pending: "#f59e0b",
    rejected: "#fca5a5",
    partial: "#fb923c",
    screening: "#94a3b8",
    open: "#60a5fa",
    neutral: "#94a3b8",
    stage: ["#94a3b8", "#f59e0b", "#34d399", "#60a5fa", "#22d3ee", "#c4b5fd", "#5eead4"]
  },
  "e-ink": {
    requested: "#8c8679",
    covered: "#4a6b52",
    folios: "#355f75",
    hired: "#4a6b52",
    mobility: "#6a5a78",
    ready: "#8a6a2a",
    pending: "#8a6a2a",
    rejected: "#8a3a3a",
    partial: "#8a4f2a",
    screening: "#6b665d",
    open: "#355f75",
    neutral: "#6b665d",
    stage: ["#6b665d", "#8a6a2a", "#4a6b52", "#355f75", "#4f6f75", "#6a5a78", "#4a634e"]
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

export function aggregatePulseData(
  timeline: BiRecruitmentDashboard["timeline"],
  view: OperationalPulseView
) {
  if (view === "daily") return timeline;

  if (view === "weekly") {
    const firstDate = new Date(`${timeline[0]?.bucketStart ?? ""}T00:00:00`);
    if (timeline.length <= 6 || Number.isNaN(firstDate.getTime())) return timeline;

    const groups = new Map<
      number,
      {
        bucketStart: string;
        bucketLabel: string;
        readyCandidates: number;
        openedFolios: number;
        hiredCandidates: number;
        executedMobilities: number;
        requestedVacancies: number;
      }
    >();

    timeline.forEach((item) => {
      const currentDate = new Date(`${item.bucketStart}T00:00:00`);
      const weekIndex = Number.isNaN(currentDate.getTime())
        ? 0
        : Math.floor((currentDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      const current = groups.get(weekIndex);

      if (current) {
        current.openedFolios += item.openedFolios;
        current.readyCandidates += item.readyCandidates;
        current.hiredCandidates += item.hiredCandidates;
        current.executedMobilities += item.executedMobilities;
        current.requestedVacancies = Math.max(current.requestedVacancies, item.requestedVacancies);
        return;
      }

      groups.set(weekIndex, {
        bucketStart: item.bucketStart,
        bucketLabel: toDayLabel(item.bucketStart),
        readyCandidates: item.readyCandidates,
        openedFolios: item.openedFolios,
        hiredCandidates: item.hiredCandidates,
        executedMobilities: item.executedMobilities,
        requestedVacancies: item.requestedVacancies
      });
    });

    return Array.from(groups.values());
  }

  if (view === "monthly") {
    const totals = timeline.reduce(
      (accumulator, item) => ({
        openedFolios: accumulator.openedFolios + item.openedFolios,
        hiredCandidates: accumulator.hiredCandidates + item.hiredCandidates,
        executedMobilities: accumulator.executedMobilities + item.executedMobilities,
        requestedVacancies: Math.max(accumulator.requestedVacancies, item.requestedVacancies)
      }),
      {
        openedFolios: 0,
        hiredCandidates: 0,
        executedMobilities: 0,
        requestedVacancies: 0
      }
    );

    return [
      {
        bucketStart: timeline[0]?.bucketStart ?? "",
        bucketLabel: toMonthLabel(timeline[0]?.bucketStart ?? ""),
        readyCandidates: 0,
        ...totals
      }
    ];
  }

  const groups = new Map<
    string,
    {
      bucketStart: string;
      bucketLabel: string;
      openedFolios: number;
      readyCandidates: number;
      hiredCandidates: number;
      executedMobilities: number;
      requestedVacancies: number;
    }
  >();

  timeline.forEach((item) => {
    const monthKey = item.bucketStart.slice(0, 7) || item.bucketLabel;
    const current = groups.get(monthKey);
    if (current) {
      current.openedFolios += item.openedFolios;
      current.readyCandidates += item.readyCandidates;
      current.hiredCandidates += item.hiredCandidates;
      current.executedMobilities += item.executedMobilities;
      current.requestedVacancies = Math.max(current.requestedVacancies, item.requestedVacancies);
      return;
    }

    groups.set(monthKey, {
      bucketStart: item.bucketStart,
      bucketLabel: toMonthLabel(item.bucketStart),
      openedFolios: item.openedFolios,
      readyCandidates: item.readyCandidates,
      hiredCandidates: item.hiredCandidates,
      executedMobilities: item.executedMobilities,
      requestedVacancies: item.requestedVacancies
    });
  });

  return Array.from(groups.values()).slice(-6);
}
