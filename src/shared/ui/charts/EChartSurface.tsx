import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { EChartsOption } from "echarts";
import type { EChartsReactProps } from "echarts-for-react";

const ReactECharts = lazy(async () => {
  const [{ default: ReactEChartsCore }, { echarts }] = await Promise.all([
    import("echarts-for-react/lib/core"),
    import("./echartsRuntime")
  ]);

  return {
    default: (props: EChartsReactProps) => <ReactEChartsCore echarts={echarts} {...props} />
  };
});

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
    palette: ["#3b82f6", "#06b6d4", "#f59e0b", "#8b5cf6", "#ef4444", "#10b981", "#f97316", "#14b8a6"]
  }));

  useEffect(() => {
    const updateTheme = () => {
      setTheme({
        text: readCssVariable("--text", "#111827"),
        textMuted: readCssVariable("--text-muted", "#64748b"),
        border: "rgba(148, 163, 184, 0.24)",
        surface: readCssVariable("--surface", "#ffffff"),
        palette: [
          readCssVariable("--primary", "#3b82f6"),
          "#06b6d4",
          "#f59e0b",
          "#8b5cf6",
          "#ef4444",
          "#10b981",
          "#f97316",
          "#14b8a6"
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
        backgroundColor: "rgba(15, 23, 42, 0.85)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        borderWidth: 1,
        textStyle: { color: "#f8fafc" },
        padding: [10, 14],
        extraCssText: "backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25); border-radius: 8px;",
        appendToBody: true,
        ...(typeof option.tooltip === "object" ? option.tooltip : {})
      },
      animationDuration: 800,
      animationEasing: "cubicOut",
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
