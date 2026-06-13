import type { CSSProperties, ReactElement } from "react";
import { ResponsiveContainer } from "recharts";

export type ChartSurfaceProps = {
  children: ReactElement;
  height?: number | string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_LOADING_MESSAGE = "Cargando gráfico...";
const DEFAULT_EMPTY_MESSAGE = "No hay datos disponibles para este gráfico.";

function resolveHeightValue(height: number | string | undefined) {
  if (typeof height === "number") {
    return `${height}px`;
  }

  return height ?? "320px";
}

export function ChartSurface({
  children,
  height = 320,
  loading = false,
  empty = false,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  loadingMessage = DEFAULT_LOADING_MESSAGE,
  className = "",
  style
}: ChartSurfaceProps) {
  return (
    <div
      className={`chart-shell ${className}`.trim()}
      style={{ height: resolveHeightValue(height), ...style }}
    >
      <div className="chart-stage">
        {!empty ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : null}
      </div>
      {loading ? <div className="chart-loading-state">{loadingMessage}</div> : null}
      {empty ? <div className="chart-empty-state">{emptyMessage}</div> : null}
    </div>
  );
}
