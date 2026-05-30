import { useEffect, useMemo, useState } from "react";
import type { DashboardBirthdayItem } from "../types";

type DashboardInfoCardsProps = {
  pendingTasksCount: number;
  approvalTrackingCount: number;
  birthdays: DashboardBirthdayItem[];
};

type WeatherState = {
  temperature: number | null;
  code: number | null;
  isLoading: boolean;
};

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-33.4489&longitude=-70.6693&current=temperature_2m,weather_code&timezone=America%2FSantiago";

function toWeatherLabel(code: number | null) {
  if (code == null) return "Sin dato";
  if ([0].includes(code)) return "Despejado";
  if ([1, 2, 3].includes(code)) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Variable";
}

function toWeatherIcon(code: number | null) {
  if (code == null) return "○";
  if ([0].includes(code)) return "☀";
  if ([1, 2, 3].includes(code)) return "☁";
  if ([45, 48].includes(code)) return "◌";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "⚡";
  return "◔";
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "short"
  }).format(new Date());
}

export function DashboardInfoCards({
  pendingTasksCount,
  approvalTrackingCount,
  birthdays
}: DashboardInfoCardsProps) {
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const [weather, setWeather] = useState<WeatherState>({
    temperature: null,
    code: null,
    isLoading: true
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const response = await fetch(WEATHER_URL, {
          signal: controller.signal
        });
        const payload = await response.json();
        const current = payload?.current ?? null;

        setWeather({
          temperature:
            typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
          code: typeof current?.weather_code === "number" ? current.weather_code : null,
          isLoading: false
        });
      } catch (_error) {
        setWeather({
          temperature: null,
          code: null,
          isLoading: false
        });
      }
    }

    void loadWeather();

    return () => controller.abort();
  }, []);

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
      <article className="dashboard-info-card dashboard-info-card-weather">
        <div className="dashboard-info-head">
          <span className="dashboard-info-kicker">{formatTodayLabel()}</span>
          <strong>Santiago, CL</strong>
        </div>
        <div className="dashboard-info-weather-body">
          <div>
            <span className="dashboard-info-primary">
              {weather.isLoading || weather.temperature == null
                ? "--°"
                : `${Math.round(weather.temperature)}°`}
            </span>
            <span className="dashboard-info-secondary">
              {weather.isLoading ? "Cargando clima..." : toWeatherLabel(weather.code)}
            </span>
          </div>
          <span className="dashboard-info-weather-icon" aria-hidden="true">
            {toWeatherIcon(weather.code)}
          </span>
        </div>
      </article>

      <article className="dashboard-info-card">
        <div className="dashboard-info-head">
          <span className="dashboard-info-kicker">Trabajo personal</span>
          <strong>Tareas pendientes</strong>
        </div>
        <span className="dashboard-info-primary">{pendingTasksCount}</span>
        <span className="dashboard-info-secondary">
          {pendingTasksCount === 1 ? "1 tarea por resolver" : `${pendingTasksCount} tareas por resolver`}
        </span>
      </article>

      <article className="dashboard-info-card">
        <div className="dashboard-info-head">
          <span className="dashboard-info-kicker">Visión global</span>
          <strong>Aprobaciones en curso</strong>
        </div>
        <span className="dashboard-info-primary">{approvalTrackingCount}</span>
        <span className="dashboard-info-secondary">
          {approvalTrackingCount === 1
            ? "1 flujo esperando resolución"
            : `${approvalTrackingCount} flujos activos`}
        </span>
      </article>

      <article className="dashboard-info-card dashboard-info-card-birthday">
        <div className="dashboard-info-head">
          <span className="dashboard-info-kicker">BUK</span>
          <strong>Cumpleaños próximos</strong>
        </div>
        {nextBirthday ? (
          <>
            <div className="dashboard-birthday-sheet">
              <div className="dashboard-birthday-sheet-header">
                <span className="dashboard-info-primary">{birthdays.length}</span>
                {birthdays.length > 1 ? (
                  <div className="dashboard-birthday-controls" aria-label="Navegación de cumpleaños">
                    <button
                      type="button"
                      className="dashboard-birthday-control"
                      onClick={() => moveBirthday("prev")}
                      aria-label="Cumpleañero anterior"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="dashboard-birthday-control"
                      onClick={() => moveBirthday("next")}
                      aria-label="Siguiente cumpleañero"
                    >
                      ›
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="dashboard-birthday-summary">
                <strong>{nextBirthday.full_name}</strong>
                <span>{nextBirthday.job_title || "Colaborador activo"}</span>
                <small>
                  {nextBirthday.birthday_label} · {birthdaySummary}
                </small>
              </div>
              {birthdays.length > 1 ? (
                <div className="dashboard-birthday-pagination" aria-label="Posición del cumpleañero">
                  {birthdays.map((birthday, index) => (
                    <button
                      key={birthday.id}
                      type="button"
                      className={`dashboard-birthday-dot${index === birthdayIndex ? " is-active" : ""}`}
                      onClick={() => setBirthdayIndex(index)}
                      aria-label={`Ver cumpleañero ${index + 1}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <span className="dashboard-info-secondary">
            No hay cumpleaños con fecha válida cargada en BUK.
          </span>
        )}
      </article>
    </section>
  );
}
