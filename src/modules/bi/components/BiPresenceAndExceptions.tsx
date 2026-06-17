import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useBiPresenceSummaryToday, useBiExceptionsToday } from "../hooks/useBiQueries";
import { useTheme } from "../../../shared/context/ThemeContext";
import { EChartSurface } from "../../../shared/ui";

export function BiPresenceAndExceptions() {
  const { data: presenceData, isLoading: isLoadingPresence } = useBiPresenceSummaryToday();
  const { data: exceptionsData, isLoading: isLoadingExceptions } = useBiExceptionsToday();
  const { theme } = useTheme();

  const isDark = theme === "dark";
  const textColor = isDark ? "#E2E8F0" : "#1E293B";

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
          startAngle: 180,
          endAngle: 0,
          min: 0,
          max: 100,
          splitNumber: 10,
          itemStyle: {
            color: overallPresencePct >= 90 ? "#10B981" : overallPresencePct >= 80 ? "#F59E0B" : "#EF4444"
          },
          progress: { show: true, width: 30 },
          pointer: { show: false },
          axisLine: { lineStyle: { width: 30, color: [[1, isDark ? "#334155" : "#E2E8F0"]] } },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          title: { show: false },
          detail: {
            valueAnimation: true,
            formatter: "{value}%",
            color: textColor,
            fontSize: 40,
            offsetCenter: [0, "-10%"]
          },
          data: [{ value: Number(overallPresencePct.toFixed(1)) }]
        }
      ]
    };
  }, [isDark, presenceData, textColor]);

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
      tooltip: { trigger: "item", backgroundColor: isDark ? "#1E293B" : "#FFFFFF", textStyle: { color: textColor } },
      legend: { top: "5%", left: "center", textStyle: { color: textColor } },
      series: [
        {
          name: "Excepciones",
          type: "pie",
          radius: ["40%", "70%"],
          itemStyle: {
            borderRadius: 10,
            borderColor: isDark ? "#0F172A" : "#FFFFFF",
            borderWidth: 2
          },
          data: seriesData
        }
      ]
    };
  }, [exceptionsData, isDark, textColor]);

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
