import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { EChartsCoreOption, EChartsType, SetOptionOpts } from "echarts/core";
import { useTheme } from "../../context/ThemeContext";
import { ensureERPChartRegistry } from "../../lib/echarts/registry";
import { resolveERPChartThemeName } from "../../lib/echarts/theme";

export type ERPChartRenderer = "canvas" | "svg";

export type EChartProps = {
  option: EChartsCoreOption;
  height?: number | string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
  style?: CSSProperties;
  renderer?: ERPChartRenderer;
  themeName?: string;
  notMerge?: boolean;
  lazyUpdate?: boolean;
  replaceMerge?: SetOptionOpts["replaceMerge"];
  onChartReady?: (chart: EChartsType) => void;
  onEvents?: Record<string, (params: unknown) => void>;
};

const DEFAULT_LOADING_TEXT = "Cargando gráfico...";
const DEFAULT_EMPTY_MESSAGE = "No hay datos disponibles para este gráfico.";

function resolveHeightValue(height: number | string | undefined) {
  if (typeof height === "number") {
    return `${height}px`;
  }

  return height ?? "320px";
}

export function EChart({
  option,
  height = 320,
  loading = false,
  empty = false,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  className = "",
  style,
  renderer = "canvas",
  themeName,
  notMerge = false,
  lazyUpdate = true,
  replaceMerge,
  onChartReady,
  onEvents
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const { resolvedTheme } = useTheme();

  const effectiveThemeName = useMemo(
    () => themeName ?? resolveERPChartThemeName(resolvedTheme),
    [resolvedTheme, themeName]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const echarts = ensureERPChartRegistry();
    const chart = echarts.init(container, effectiveThemeName, {
      renderer,
      useDirtyRect: true
    });

    chartRef.current = chart;
    onChartReady?.(chart);

    return () => {
      chartRef.current = null;
      chart.dispose();
    };
  }, [effectiveThemeName, onChartReady, renderer]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    if (empty) {
      chart.clear();
      return;
    }

    chart.setOption(option, {
      notMerge,
      lazyUpdate,
      replaceMerge
    });
  }, [empty, lazyUpdate, notMerge, option, replaceMerge]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    if (loading) {
      chart.showLoading("default", {
        text: DEFAULT_LOADING_TEXT,
        color: "#2d63ff",
        textColor: "#6b7280",
        maskColor: "rgba(255,255,255,0.08)"
      });
      return;
    }

    chart.hideLoading();
  }, [loading]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) {
      return;
    }

    const handlers = Object.entries(onEvents);
    handlers.forEach(([eventName, handler]) => {
      chart.on(eventName, handler);
    });

    return () => {
      handlers.forEach(([eventName, handler]) => {
        chart.off(eventName, handler);
      });
    };
  }, [onEvents]);

  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;

    if (!chart || !container) {
      return;
    }

    const resizeChart = () => {
      chart.resize();
    };

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resizeChart);
      return () => {
        window.removeEventListener("resize", resizeChart);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeChart();
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", resizeChart);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeChart);
    };
  }, []);

  return (
    <div
      className={`echart-shell ${className}`.trim()}
      style={{ height: resolveHeightValue(height), ...style }}
    >
      <div ref={containerRef} className="echart-stage" />
      {empty ? <div className="echart-empty-state">{emptyMessage}</div> : null}
    </div>
  );
}
