export type ERPChartThemeName = "erp-light" | "erp-dark" | "erp-e-ink";
export type ERPAppTheme = "light" | "dark" | "e-ink";

type EChartsThemeDefinition = {
  color: string[];
  backgroundColor: string;
  textStyle: {
    color: string;
    fontFamily: string;
  };
  title: {
    textStyle: { color: string; fontWeight: number };
    subtextStyle: { color: string };
  };
  legend: {
    textStyle: { color: string };
  };
  toolbox: {
    iconStyle: {
      borderColor: string;
    };
  };
  tooltip: {
    backgroundColor: string;
    borderColor: string;
    textStyle: { color: string };
  };
  categoryAxis: {
    axisLine: { lineStyle: { color: string } };
    axisTick: { lineStyle: { color: string } };
    axisLabel: { color: string };
    splitLine: { lineStyle: { color: string } };
    nameTextStyle: { color: string };
  };
  valueAxis: {
    axisLine: { lineStyle: { color: string } };
    axisTick: { lineStyle: { color: string } };
    axisLabel: { color: string };
    splitLine: { lineStyle: { color: string } };
    nameTextStyle: { color: string };
  };
};

const chartThemes: Record<ERPChartThemeName, EChartsThemeDefinition> = {
  "erp-light": {
    color: ["#2d63ff", "#1f9d70", "#f5b700", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316"],
    backgroundColor: "transparent",
    textStyle: {
      color: "#111827",
      fontFamily:
        '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    title: {
      textStyle: { color: "#111827", fontWeight: 700 },
      subtextStyle: { color: "#6b7280" }
    },
    legend: {
      textStyle: { color: "#334155" }
    },
    toolbox: {
      iconStyle: {
        borderColor: "#64748b"
      }
    },
    tooltip: {
      backgroundColor: "rgba(17, 24, 39, 0.96)",
      borderColor: "#1f2937",
      textStyle: { color: "#f8fafc" }
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#475569" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
      nameTextStyle: { color: "#475569" }
    },
    valueAxis: {
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#475569" },
      splitLine: { lineStyle: { color: "#e2e8f0" } },
      nameTextStyle: { color: "#475569" }
    }
  },
  "erp-dark": {
    color: ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#fb923c"],
    backgroundColor: "transparent",
    textStyle: {
      color: "#f8fafc",
      fontFamily:
        '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    title: {
      textStyle: { color: "#f8fafc", fontWeight: 700 },
      subtextStyle: { color: "#94a3b8" }
    },
    legend: {
      textStyle: { color: "#cbd5e1" }
    },
    toolbox: {
      iconStyle: {
        borderColor: "#cbd5e1"
      }
    },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.96)",
      borderColor: "#334155",
      textStyle: { color: "#f8fafc" }
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: "#475569" } },
      axisTick: { lineStyle: { color: "#475569" } },
      axisLabel: { color: "#cbd5e1" },
      splitLine: { lineStyle: { color: "#334155" } },
      nameTextStyle: { color: "#cbd5e1" }
    },
    valueAxis: {
      axisLine: { lineStyle: { color: "#475569" } },
      axisTick: { lineStyle: { color: "#475569" } },
      axisLabel: { color: "#cbd5e1" },
      splitLine: { lineStyle: { color: "#334155" } },
      nameTextStyle: { color: "#cbd5e1" }
    }
  },
  "erp-e-ink": {
    color: ["#111111", "#3a3a3a", "#5b5b5b", "#777777", "#929292", "#262626", "#4a4a4a"],
    backgroundColor: "transparent",
    textStyle: {
      color: "#111111",
      fontFamily: '"Bookerly", Georgia, "Times New Roman", serif'
    },
    title: {
      textStyle: { color: "#111111", fontWeight: 700 },
      subtextStyle: { color: "#4a4a4a" }
    },
    legend: {
      textStyle: { color: "#111111" }
    },
    toolbox: {
      iconStyle: {
        borderColor: "#1d1d1d"
      }
    },
    tooltip: {
      backgroundColor: "#fbfaf5",
      borderColor: "#1d1d1d",
      textStyle: { color: "#111111" }
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: "#4a4a4a" } },
      axisTick: { lineStyle: { color: "#4a4a4a" } },
      axisLabel: { color: "#111111" },
      splitLine: { lineStyle: { color: "#d6d1c6" } },
      nameTextStyle: { color: "#111111" }
    },
    valueAxis: {
      axisLine: { lineStyle: { color: "#4a4a4a" } },
      axisTick: { lineStyle: { color: "#4a4a4a" } },
      axisLabel: { color: "#111111" },
      splitLine: { lineStyle: { color: "#d6d1c6" } },
      nameTextStyle: { color: "#111111" }
    }
  }
};

export function resolveERPChartThemeName(theme: ERPAppTheme): ERPChartThemeName {
  if (theme === "dark") {
    return "erp-dark";
  }

  if (theme === "e-ink") {
    return "erp-e-ink";
  }

  return "erp-light";
}

export function getERPChartThemes() {
  return chartThemes;
}
