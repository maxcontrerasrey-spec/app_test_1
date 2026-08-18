export type SegmentedStatusSegment = {
  key: string;
  label: string;
  value: number;
  /** Clase de color semantico: "approved" | "pending" | "rejected" | "neutral" */
  tone: "approved" | "pending" | "rejected" | "neutral";
};

type SegmentedStatusBarProps = {
  segments: SegmentedStatusSegment[];
  totalLabel?: string;
};

/**
 * Barra horizontal 100% apilada para estados (aprobado/pendiente/rechazado).
 * Componente CSS puro (sin ECharts) reutilizado por el detalle de
 * Incentivos y por el Resumen Ejecutivo para no duplicar la construccion
 * del grafico ni montar una instancia de chart extra para algo tan simple.
 */
export function SegmentedStatusBar({ segments, totalLabel }: SegmentedStatusBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total <= 0) {
    return <div className="bi-empty-state">Sin solicitudes para el filtro.</div>;
  }

  return (
    <div className="bi-segmented-status-bar">
      <div className="bi-segmented-status-track" role="img" aria-label={totalLabel ?? "Distribución de estados"}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className={`bi-segmented-status-fill bi-segmented-status-fill-${segment.tone}`}
              style={{ width: `${(segment.value / total) * 100}%` }}
              title={`${segment.label}: ${segment.value.toLocaleString("es-CL")}`}
            />
          ))}
      </div>
      <div className="bi-segmented-status-legend">
        {segments.map((segment) => (
          <span key={segment.key} className={`bi-segmented-status-legend-item bi-segmented-status-legend-${segment.tone}`}>
            <i />
            {segment.label} · {segment.value.toLocaleString("es-CL")}
          </span>
        ))}
      </div>
    </div>
  );
}
