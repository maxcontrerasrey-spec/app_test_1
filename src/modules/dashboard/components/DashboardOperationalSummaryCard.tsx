import { useEffect, useMemo, useState } from "react";
import type { DashboardOperationalSummary } from "../types";

type DashboardOperationalSummaryCardProps = {
  summary: DashboardOperationalSummary | null;
};

type SummaryMetric = {
  label: string;
  value: string;
};

type SummarySheet = {
  id: "recruitment" | "workforce" | "incentives";
  eyebrow: string;
  title: string;
  caption: string;
  metrics: SummaryMetric[];
};

const numberFormatter = new Intl.NumberFormat("es-CL");

function formatCount(value: number | null | undefined) {
  return numberFormatter.format(Math.max(0, Math.trunc(value ?? 0)));
}

function formatPercent(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(1)}%`;
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
        title: "Procesos y avance",
        caption: "Respeta el mismo alcance visible del solicitante o CECO asignado.",
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
        title: "Estado de hoy",
        caption: "Ausentismo calculado sobre vacaciones, licencias y otras ausencias activas hoy.",
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
        title: "Estado extraordinario",
        caption: "Total emitido excluye solicitudes rechazadas.",
        metrics: [
          { label: "Emitidos", value: formatCount(incentives?.totalGenerated) },
          { label: "Pendientes", value: formatCount(incentives?.pendingApproval) },
          { label: "Aprobados", value: formatCount(incentives?.approved) }
        ]
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
    <article className="dashboard-info-card dashboard-info-card-operations">
      <div className="dashboard-operations-card-header">
        <div className="dashboard-info-head">
          <strong style={{ fontSize: "1.05rem" }}>{activeSheet.eyebrow}</strong>
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

      <p className="dashboard-operations-caption">{activeSheet.caption}</p>

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
    </article>
  );
}
