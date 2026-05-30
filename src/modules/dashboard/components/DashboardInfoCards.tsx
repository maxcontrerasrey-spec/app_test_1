import { useEffect, useMemo, useState } from "react";
import type { DashboardBirthdayItem } from "../types";

type DashboardInfoCardsProps = {
  pendingTasksCount: number;
  approvalTrackingCount: number;
  birthdays: DashboardBirthdayItem[];
};

type WeatherState = {
  temperature: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
  code: number | null;
  isLoading: boolean;
};

type LiveLocationState = {
  label: string;
  statusLabel: string;
  latitude: number;
  longitude: number;
  isResolved: boolean;
};

const DEFAULT_LOCATION: LiveLocationState = {
  label: "Santiago, CL",
  statusLabel: "Ubicación no disponible",
  latitude: -33.4489,
  longitude: -70.6693,
  isResolved: false
};

function buildWeatherUrl(latitude: number, longitude: number) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=America%2FSantiago`;
}

function buildReverseGeocodingUrl(latitude: number, longitude: number) {
  return `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=es&format=json`;
}

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

function formatLocationLabel(payload: unknown) {
  const firstResult = Array.isArray((payload as { results?: unknown[] } | null)?.results)
    ? ((payload as { results: Array<Record<string, unknown>> }).results[0] ?? null)
    : null;

  if (!firstResult) {
    return null;
  }

  const city =
    (typeof firstResult.city === "string" && firstResult.city.trim()) ||
    (typeof firstResult.town === "string" && firstResult.town.trim()) ||
    (typeof firstResult.village === "string" && firstResult.village.trim()) ||
    (typeof firstResult.locality === "string" && firstResult.locality.trim()) ||
    null;
  const countryCode =
    typeof firstResult.country_code === "string" && firstResult.country_code.trim()
      ? firstResult.country_code.trim().toUpperCase()
      : "CL";

  return city ? `${city}, ${countryCode}` : null;
}

export function DashboardInfoCards({
  pendingTasksCount,
  approvalTrackingCount,
  birthdays
}: DashboardInfoCardsProps) {
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const [location, setLocation] = useState<LiveLocationState>(DEFAULT_LOCATION);
  const [weather, setWeather] = useState<WeatherState>({
    temperature: null,
    temperatureMax: null,
    temperatureMin: null,
    code: null,
    isLoading: true
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveLocation(latitude: number, longitude: number, statusLabel: string) {
      try {
        const response = await fetch(buildReverseGeocodingUrl(latitude, longitude));
        const payload = await response.json();
        const label = formatLocationLabel(payload) ?? DEFAULT_LOCATION.label;

        if (!cancelled) {
          setLocation({
            label,
            statusLabel,
            latitude,
            longitude,
            isResolved: true
          });
        }
      } catch (_error) {
        if (!cancelled) {
          setLocation({
            label: DEFAULT_LOCATION.label,
            statusLabel,
            latitude,
            longitude,
            isResolved: true
          });
        }
      }
    }

    if (!navigator.geolocation) {
      setLocation(DEFAULT_LOCATION);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void resolveLocation(
          position.coords.latitude,
          position.coords.longitude,
          "Ubicación actual"
        );
      },
      () => {
        if (!cancelled) {
          setLocation(DEFAULT_LOCATION);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 300000
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      try {
        const response = await fetch(buildWeatherUrl(location.latitude, location.longitude), {
          signal: controller.signal
        });
        const payload = await response.json();
        const current = payload?.current ?? null;
        const daily = payload?.daily ?? null;

        setWeather({
          temperature:
            typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
          temperatureMax:
            typeof daily?.temperature_2m_max?.[0] === "number" ? daily.temperature_2m_max[0] : null,
          temperatureMin:
            typeof daily?.temperature_2m_min?.[0] === "number" ? daily.temperature_2m_min[0] : null,
          code: typeof current?.weather_code === "number" ? current.weather_code : null,
          isLoading: false
        });
      } catch (_error) {
        setWeather({
          temperature: null,
          temperatureMax: null,
          temperatureMin: null,
          code: null,
          isLoading: false
        });
      }
    }

    setWeather((current) => ({
      ...current,
      isLoading: true
    }));
    void loadWeather();

    return () => controller.abort();
  }, [location.latitude, location.longitude]);

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
          <strong>{location.label}</strong>
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
            <span className="dashboard-info-weather-range">
              {weather.isLoading || weather.temperatureMax == null || weather.temperatureMin == null
                ? "Máx --° · Mín --°"
                : `Máx ${Math.round(weather.temperatureMax)}° · Mín ${Math.round(weather.temperatureMin)}°`}
            </span>
            <span className="dashboard-info-weather-zone">
              {location.isResolved ? location.statusLabel : "Resolviendo ubicación..."}
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
        ) : (
          <span className="dashboard-info-secondary">
            No hay cumpleaños con fecha válida cargada en BUK.
          </span>
        )}
      </article>
    </section>
  );
}
