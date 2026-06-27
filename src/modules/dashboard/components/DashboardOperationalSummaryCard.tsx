import { useEffect, useMemo, useState } from "react";
import { formatCurrencyValue, formatNumberValue, formatPercentValue } from "../../../shared/lib/format";
import type { DashboardOperationalSummary } from "../types";
import { SoftSurface } from "../../../shared/ui";

type DashboardOperationalSummaryCardProps = {
  summary: DashboardOperationalSummary | null;
};

type SummaryMetric = {
  label: string;
  value: string;
};

type SummaryHighlight = {
  label: string;
  value: string;
};

type SummarySheet = {
  id: "recruitment" | "workforce" | "incentives";
  eyebrow: string;
  metrics: SummaryMetric[];
  highlight?: SummaryHighlight | null;
};

function formatCount(value: number | null | undefined) {
  return formatNumberValue(Math.max(0, Math.trunc(value ?? 0)), "0");
}

function formatPercent(value: number | null | undefined) {
  return formatPercentValue(Number(value ?? 0), 1, "0.0%");
}

function formatCurrency(value: number | null | undefined) {
  return formatCurrencyValue(Math.max(0, Number(value ?? 0)), { fallback: "$0" });
}

export function DashboardOperationalSummaryCard({
  summary
}: DashboardOperationalSummaryCardProps) {
  const sheets = useMemo<SummarySheet[]>(() => {
    const recruitment = summary?.recruitment;
    const workforce = summary?.workforce;
    const incentives = summary?.incentives;

    return [
      {
        id: "recruitment",
        eyebrow: "Reclutamiento",
        metrics: [
          { label: "Procesos abiertos", value: formatCount(recruitment?.openProcesses) },
          { label: "Cupos solicitados", value: formatCount(recruitment?.requestedVacancies) },
          { label: "Candidatos en curso", value: formatCount(recruitment?.inProgressCandidates) },
          { label: "Contratados", value: formatCount(recruitment?.hiredCandidates) }
        ]
      },
      {
        id: "workforce",
        eyebrow: "Dotación",
        metrics: [
          { label: "Personas contratadas", value: formatCount(workforce?.totalEmployees) },
          { label: "Lic. médicas (hoy)", value: formatCount(workforce?.medicalLeavesToday) },
          { label: "Vacaciones (hoy)", value: formatCount(workforce?.vacationsToday) },
          { label: "% Ausentismo", value: formatPercent(workforce?.absenteeismPct) }
        ]
      },
      {
        id: "incentives",
        eyebrow: "Incentivos",
        metrics: [
          { label: "Aprobados", value: formatCount(incentives?.approved) },
          { label: "Pendientes", value: formatCount(incentives?.pendingApproval) }
        ],
        highlight: {
          label: "Monto total",
          value: formatCurrency(incentives?.totalAmount)
        }
      }
    ];
  }, [summary]);

  const [sheetIndex, setSheetIndex] = useState(0);

  useEffect(() => {
    setSheetIndex((current) => (current >= sheets.length ? 0 : current));
  }, [sheets.length]);

  useEffect(() => {
    if (sheets.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSheetIndex((current) => (current + 1) % sheets.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [sheets.length]);

  const activeSheet = sheets[sheetIndex] ?? sheets[0];

  function moveSheet(direction: "prev" | "next") {
    if (sheets.length <= 1) {
      return;
    }

    setSheetIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? sheets.length - 1 : current - 1;
      }

      return (current + 1) % sheets.length;
    });
  }

  if (!activeSheet) {
    return null;
  }

  return (
    <SoftSurface
      as="article"
      className="dashboard-info-card dashboard-info-card-operations"
      variant="raised"
    >
      <div className="dashboard-operations-card-header">
        <div className="dashboard-info-head">
          <strong className="dashboard-operations-heading">{activeSheet.eyebrow}</strong>
        </div>
        <div className="dashboard-birthday-controls" aria-label="Navegación de resumen operativo">
          <button
            type="button"
            className="dashboard-birthday-control"
            onClick={() => moveSheet("prev")}
            aria-label="Resumen anterior"
          >
            ‹
          </button>
          <button
            type="button"
            className="dashboard-birthday-control"
            onClick={() => moveSheet("next")}
            aria-label="Siguiente resumen"
          >
            ›
          </button>
        </div>
      </div>

      <div className="dashboard-operations-grid">
        {activeSheet.metrics.map((metric) => (
          <div key={metric.label} className="dashboard-operations-item">
            <span className="dashboard-operations-label">{metric.label}</span>
            <strong className="dashboard-operations-value">{metric.value}</strong>
          </div>
        ))}
      </div>

      {activeSheet.highlight ? (
        <div className="dashboard-operations-highlight">
          <span className="dashboard-operations-highlight-label">{activeSheet.highlight.label}</span>
          <strong className="dashboard-operations-highlight-value">{activeSheet.highlight.value}</strong>
        </div>
      ) : null}

      <div className="dashboard-birthday-pagination" aria-label="Posición del resumen operativo">
        {sheets.map((sheet, index) => (
          <button
            key={sheet.id}
            type="button"
            className={`dashboard-birthday-dot${index === sheetIndex ? " is-active" : ""}`}
            onClick={() => setSheetIndex(index)}
            aria-label={`Ver resumen ${index + 1}`}
          />
        ))}
      </div>
    </SoftSurface>
  );
}
