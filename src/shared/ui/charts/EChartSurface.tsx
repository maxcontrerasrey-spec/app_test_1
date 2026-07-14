import { Suspense, lazy, useMemo } from "react";
import type { CSSProperties } from "react";
import type { EChartsOption } from "echarts";
import type { EChartsReactProps } from "echarts-for-react";
import { useChartTheme } from "./chartTheme";

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
        backgroundColor: theme.tooltipSurface,
        borderColor: theme.border,
        borderWidth: 1,
        textStyle: { color: theme.tooltipText },
        padding: [10, 14],
        extraCssText: "backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 8px;",
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
