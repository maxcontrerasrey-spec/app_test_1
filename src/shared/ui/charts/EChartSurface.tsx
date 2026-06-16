import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { EChartsOption } from "echarts";
import type { EChartsReactProps } from "echarts-for-react";

const ReactECharts = lazy(async () => ({
  default: (await import("echarts-for-react")).default
}));

export type EChartSurfaceProps = {
  option: EChartsOption;
  height?: number | string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  style?: CSSProperties;
  onEvents?: EChartsReactProps["onEvents"];
};

const DEFAULT_LOADING_MESSAGE = "Cargando gráfico...";
const DEFAULT_EMPTY_MESSAGE = "No hay datos disponibles para este gráfico.";

function resolveHeightValue(height: number | string | undefined) {
  if (typeof height === "number") {
    return `${height}px`;
  }

  return height ?? "320px";
}

function readCssVariable(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function useChartTheme() {
  const [theme, setTheme] = useState(() => ({
    text: "#111827",
    textMuted: "#64748b",
    border: "rgba(148, 163, 184, 0.24)",
    surface: "#ffffff",
    palette: ["#2563eb", "#0f766e", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#b45309"]
  }));

  useEffect(() => {
    const updateTheme = () => {
      setTheme({
        text: readCssVariable("--text", "#111827"),
        textMuted: readCssVariable("--text-muted", "#64748b"),
        border: "rgba(148, 163, 184, 0.24)",
        surface: readCssVariable("--surface", "#ffffff"),
        palette: [
          readCssVariable("--primary", "#2563eb"),
          "#0f766e",
          "#d97706",
          "#7c3aed",
          "#dc2626",
          "#0891b2",
          "#65a30d",
          "#b45309"
        ]
      });
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export function EChartSurface({
  option,
  height = 320,
  loading = false,
  empty = false,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  loadingMessage = DEFAULT_LOADING_MESSAGE,
  className = "",
  style,
  onEvents
}: EChartSurfaceProps) {
  const theme = useChartTheme();

  const themedOption = useMemo<EChartsOption>(() => {
    return {
      color: option.color ?? theme.palette,
      textStyle: {
        color: theme.textMuted,
        fontFamily: "inherit",
        ...(typeof option.textStyle === "object" ? option.textStyle : {})
      },
      tooltip: {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        textStyle: { color: theme.text },
        appendToBody: true,
        ...(typeof option.tooltip === "object" ? option.tooltip : {})
      },
      ...option
    };
  }, [option, theme]);

  return (
    <div
      className={`chart-shell ${className}`.trim()}
      style={{ height: resolveHeightValue(height), ...style }}
    >
      <div className="chart-stage">
        {!empty ? (
          <Suspense fallback={<div className="chart-loading-state">{loadingMessage}</div>}>
            <ReactECharts
              option={themedOption}
              style={{ width: "100%", height: "100%" }}
              notMerge
              lazyUpdate
              opts={{ renderer: "canvas" }}
              onEvents={onEvents}
            />
          </Suspense>
        ) : null}
      </div>
      {loading ? <div className="chart-loading-state">{loadingMessage}</div> : null}
      {empty ? <div className="chart-empty-state">{emptyMessage}</div> : null}
    </div>
  );
}
