import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiPresenceSummaryToday, useBiExceptionsToday } from "../hooks/useBiQueries";
import { EChartSurface, useChartTheme } from "../../../shared/ui";
import type { BiFilters } from "../types";

type BiPresenceAndExceptionsProps = {
  filters?: BiFilters;
};

export function BiPresenceAndExceptions({ filters }: BiPresenceAndExceptionsProps) {
  const { data: presenceData, isLoading: isLoadingPresence } = useBiPresenceSummaryToday(filters);
  const { data: exceptionsData, isLoading: isLoadingExceptions } = useBiExceptionsToday(filters);
  const chartTheme = useChartTheme();

  const gaugeOption = useMemo<EChartsOption | null>(() => {
    if (!presenceData || presenceData.length === 0) {
      return null;
    }

    const totalHeadcount = presenceData.reduce((acc, d) => acc + d.headcount, 0);
    const totalPresent = presenceData.reduce((acc, d) => acc + d.presentToday, 0);
    const overallPresencePct = totalHeadcount > 0 ? (totalPresent / totalHeadcount) * 100 : 0;

    return {
      series: [
        {
          type: "gauge",
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 10,
          itemStyle: {
            color: overallPresencePct >= 90 ? chartTheme.success : overallPresencePct >= 80 ? chartTheme.warning : chartTheme.danger,
            shadowColor: "rgba(2, 6, 23, 0.2)",
            shadowBlur: 10,
            shadowOffsetX: 2,
            shadowOffsetY: 2
          },
          progress: { show: true, roundCap: true, width: 18 },
          pointer: {
            icon: "path://M12.8,0.7l12,40.1H0.7L12.8,0.7z",
            length: "12%",
            width: 20,
            offsetCenter: [0, "-60%"],
            itemStyle: { color: "inherit" }
          },
          axisLine: { roundCap: true, lineStyle: { width: 18, color: [[1, chartTheme.border]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            backgroundColor: chartTheme.tooltipSurface,
            borderColor: overallPresencePct >= 90 ? chartTheme.success : overallPresencePct >= 80 ? chartTheme.warning : chartTheme.danger,
            borderWidth: 2,
            width: "50%",
            lineHeight: 40,
            height: 40,
            borderRadius: 8,
            offsetCenter: [0, "35%"],
            valueAnimation: true,
            formatter: function (value: number) {
              return "{value|" + value.toFixed(1) + "}{unit|%}";
            },
            rich: {
              value: { fontSize: 30, fontWeight: "bolder", color: chartTheme.text },
              unit: { fontSize: 16, color: chartTheme.text, padding: [0, 0, -10, 5] }
            }
          },
          data: [{ value: Number(overallPresencePct.toFixed(1)) }]
        }
      ]
    };
  }, [chartTheme, presenceData]);

  const exceptionsOption = useMemo<EChartsOption | null>(() => {
    if (!exceptionsData || exceptionsData.length === 0) {
      return null;
    }

    const groupedByType = exceptionsData.reduce((acc, curr) => {
      acc[curr.exceptionType] = (acc[curr.exceptionType] || 0) + curr.totalPersons;
      return acc;
    }, {} as Record<string, number>);

    const seriesData = Object.entries(groupedByType).map(([type, count]) => ({
      name: type === "vacation" ? "Vacaciones" : type === "medical_leave" ? "Licencias Médicas" : "Otros ausentismos",
      value: count
    }));

    return {
      tooltip: { trigger: "item", backgroundColor: chartTheme.tooltipSurface, textStyle: { color: chartTheme.tooltipText } },
      legend: { top: "5%", left: "center", textStyle: { color: chartTheme.text } },
      series: [
        {
          name: "Excepciones",
          type: "pie",
          radius: ["40%", "70%"],
          itemStyle: {
            borderRadius: 10,
            borderColor: chartTheme.surface,
            borderWidth: 2
          },
          data: seriesData
        }
      ]
    };
  }, [chartTheme, exceptionsData]);

  return (
    <div className="bi-chart-row">
      <div className="info-card">
        <h3 className="bi-chart-title">Presencia General Hoy</h3>
        <EChartSurface
          height={300}
          option={gaugeOption ?? {}}
          loading={isLoadingPresence}
          empty={!gaugeOption}
          emptyMessage="Sin datos de presencia"
          loadingMessage="Cargando datos..."
        />
      </div>
      <div className="info-card">
        <h3 className="bi-chart-title">Composición de Ausentismo Hoy</h3>
        <EChartSurface
          height={300}
          option={exceptionsOption ?? {}}
          loading={isLoadingExceptions}
          empty={!exceptionsOption}
          emptyMessage="Sin excepciones hoy"
          loadingMessage="Cargando datos..."
        />
      </div>
    </div>
  );
}
