import { useEffect, useState } from "react";

export type EChartThemeTokens = {
  text: string;
  textMuted: string;
  border: string;
  surface: string;
  tooltipSurface: string;
  tooltipText: string;
  primary: string;
  info: string;
  warning: string;
  success: string;
  danger: string;
  palette: string[];
};

export function readCssVariable(name: string, fallback: string) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function resolveChartTheme(): EChartThemeTokens {
  const primary = readCssVariable("--color-primary", readCssVariable("--primary", "#3b82f6"));
  const info = readCssVariable("--color-info", "#38bdf8");
  const warning = readCssVariable("--color-warning", "#f59e0b");
  const success = readCssVariable("--color-success", "#22c55e");
  const danger = readCssVariable("--color-danger", "#ef4444");

  return {
    text: readCssVariable("--color-text-primary", readCssVariable("--text", "#111827")),
    textMuted: readCssVariable("--color-text-muted", readCssVariable("--text-muted", "#64748b")),
    border: readCssVariable("--color-border-default", "rgba(148, 163, 184, 0.24)"),
    surface: readCssVariable("--surface", "#ffffff"),
    tooltipSurface: readCssVariable("--color-bg-surface-elevated", "rgba(15, 23, 42, 0.85)"),
    tooltipText: readCssVariable("--color-text-primary", "#f8fafc"),
    primary,
    info,
    warning,
    success,
    danger,
    palette: [
      primary,
      info,
      warning,
      success,
      danger,
      readCssVariable("--color-info-text", "#7dd3fc"),
      readCssVariable("--color-warning-text", "#fcd34d"),
      readCssVariable("--color-success-text", "#86efac")
    ]
  };
}

export function useChartTheme() {
  const [theme, setTheme] = useState<EChartThemeTokens>(() => resolveChartTheme());

  useEffect(() => {
    const updateTheme = () => setTheme(resolveChartTheme());

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => observer.disconnect();
  }, []);

  return theme;
}
