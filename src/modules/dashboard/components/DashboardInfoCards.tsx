import { useEffect, useMemo, useState } from "react";
import { useDashboardWeather } from "../hooks/useDashboardWeather";
import type { DashboardBirthdayItem, DashboardOperationalSummary } from "../types";
import { DashboardBirthdayCard } from "./DashboardBirthdayCard";
import { DashboardEconomicCard } from "./DashboardEconomicCard";
import { DashboardOperationalSummaryCard } from "./DashboardOperationalSummaryCard";
import { DashboardWeatherCard } from "./DashboardWeatherCard";

type DashboardInfoCardsProps = {
  birthdays: DashboardBirthdayItem[];
  operationalSummary: DashboardOperationalSummary | null;
};

export function DashboardInfoCards({
  birthdays,
  operationalSummary
}: DashboardInfoCardsProps) {
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const { location, weather, weatherThemeClass, requestBrowserLocation } = useDashboardWeather();

  useEffect(() => {
    if (birthdays.length <= 1) {
      setBirthdayIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setBirthdayIndex((current) => (current + 1) % birthdays.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [birthdays]);

  const nextBirthday = birthdays[birthdayIndex] ?? null;
  const birthdaySummary = useMemo(() => {
    if (!nextBirthday) {
      return "Sin cumpleaños próximos";
    }

    if (nextBirthday.days_until === 0) {
      return "Hoy";
    }

    if (nextBirthday.days_until === 1) {
      return "Mañana";
    }

    return `${nextBirthday.days_until} días`;
  }, [nextBirthday]);

  function moveBirthday(direction: "prev" | "next") {
    if (birthdays.length <= 1) return;

    setBirthdayIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? birthdays.length - 1 : current - 1;
      }

      return (current + 1) % birthdays.length;
    });
  }

  return (
    <section className="dashboard-info-row" aria-label="Tarjetas informativas">
      <DashboardWeatherCard
        themeClass={weatherThemeClass}
        isLoading={weather.isLoading}
        temperature={weather.temperature}
        code={weather.code}
        locationLabel={location.label}
        locationStatusLabel={location.statusLabel}
        dailyForecast={weather.dailyForecast}
        showRetry={location.isFallback || !location.isResolved}
        onRetry={() => void requestBrowserLocation()}
      />

      <DashboardBirthdayCard
        birthdays={birthdays}
        birthdayIndex={birthdayIndex}
        nextBirthday={nextBirthday}
        birthdaySummary={birthdaySummary}
        onMove={moveBirthday}
        onSelect={setBirthdayIndex}
      />

      <DashboardEconomicCard />
      <DashboardOperationalSummaryCard summary={operationalSummary} />
    </section>
  );
}
