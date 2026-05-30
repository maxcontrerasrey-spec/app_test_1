import { useEffect, useMemo, useState } from "react";
import { DashboardNewsWidget } from "./DashboardNewsRow";
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
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code&forecast_days=2&timeformat=unixtime&timezone=America%2FSantiago`;
}

function buildReverseGeocodingUrl(latitude: number, longitude: number) {
  return `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`;
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

function toWeatherIcon(code: number | null, size: number = 30, strokeWidth: number = 1.8) {
  const defaultProps = {
    width: size.toString(),
    height: size.toString(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth.toString(),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (code == null) return <svg {...defaultProps}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
  
  if ([0].includes(code)) {
    return (
      <svg {...defaultProps}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
    );
  }
  
  if ([1, 2, 3].includes(code)) {
    return (
      <svg {...defaultProps}>
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
      </svg>
    );
  }
  
  if ([45, 48].includes(code)) {
    return (
      <svg {...defaultProps}>
        <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        <path d="M8 22h8" />
        <path d="M10 22v-4" />
        <path d="M14 22v-4" />
      </svg>
    );
  }
  
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return (
      <svg {...defaultProps}>
        <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" />
        <path d="M16 14v6" />
        <path d="M8 14v6" />
        <path d="M12 16v6" />
      </svg>
    );
  }
  
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return (
      <svg {...defaultProps}>
        <path d="m8 15 4-4 4 4" />
        <path d="m16 9-4 4-4-4" />
        <path d="M12 3v18" />
      </svg>
    );
  }
  
  if ([95, 96, 99].includes(code)) {
    return (
      <svg {...defaultProps}>
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
        <polyline points="13 11 9 17 15 17 11 23" />
      </svg>
    );
  }
  
  return (
    <svg {...defaultProps}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "short"
  }).format(new Date());
}

function formatLocationLabel(payload: unknown) {
  const data = payload as { city?: string; locality?: string; principalSubdivision?: string; countryCode?: string } | null;
  if (!data) return null;

  const city =
    (typeof data.city === "string" && data.city.trim()) ||
    (typeof data.locality === "string" && data.locality.trim()) ||
    (typeof data.principalSubdivision === "string" && data.principalSubdivision.trim()) ||
    null;

  const countryCode =
    typeof data.countryCode === "string" && data.countryCode.trim()
      ? data.countryCode.trim().toUpperCase()
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
  const [weather, setWeather] = useState<WeatherState & { hourlyForecast: { time: number; temperature: number; code: number }[] }>({
    temperature: null,
    temperatureMax: null,
    temperatureMin: null,
    code: null,
    isLoading: true,
    hourlyForecast: []
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
        const hourly = payload?.hourly ?? null;

        const nextHours: { time: number; temperature: number; code: number }[] = [];
        if (hourly?.time && hourly?.temperature_2m && hourly?.weather_code) {
          const nowSec = Math.floor(Date.now() / 1000);
          for (let i = 0; i < hourly.time.length; i++) {
            const timeSec = hourly.time[i];
            if (timeSec + 3600 > nowSec) {
              nextHours.push({
                time: timeSec,
                temperature: hourly.temperature_2m[i],
                code: hourly.weather_code[i]
              });
              if (nextHours.length === 5) break;
            }
          }
        }

        setWeather({
          temperature:
            typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
          temperatureMax:
            typeof daily?.temperature_2m_max?.[0] === "number" ? daily.temperature_2m_max[0] : null,
          temperatureMin:
            typeof daily?.temperature_2m_min?.[0] === "number" ? daily.temperature_2m_min[0] : null,
          code: typeof current?.weather_code === "number" ? current.weather_code : null,
          isLoading: false,
          hourlyForecast: nextHours
        });
      } catch (_error) {
        setWeather({
          temperature: null,
          temperatureMax: null,
          temperatureMin: null,
          code: null,
          isLoading: false,
          hourlyForecast: []
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

  let weatherThemeClass = "";
  if (!weather.isLoading && weather.temperature !== null) {
    if (weather.temperature >= 26) {
      weatherThemeClass = " is-warm";
    } else if (weather.temperature <= 12) {
      weatherThemeClass = " is-cold";
    } else if (weather.code !== null && [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weather.code)) {
      weatherThemeClass = " is-rainy";
    }
  }

  return (
    <section className="dashboard-info-row" aria-label="Tarjetas informativas">
      <article className={`dashboard-info-card dashboard-info-card-weather${weatherThemeClass}`}>
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
        
        {weather.hourlyForecast.length > 0 && (
          <div className="dashboard-info-weather-hourly">
            {weather.hourlyForecast.map((h, i) => {
              const date = new Date(h.time * 1000);
              const hoursStr = date.getHours().toString().padStart(2, "0") + ":00";
              return (
                <div key={i} className="dashboard-weather-hour-item">
                  <span className="dashboard-weather-hour-time">{hoursStr}</span>
                  <span className="dashboard-weather-hour-icon">
                    {toWeatherIcon(h.code, 16, 1.8)}
                  </span>
                  <span className="dashboard-weather-hour-temp">{Math.round(h.temperature)}°</span>
                </div>
              );
            })}
          </div>
        )}
      </article>

      <DashboardNewsWidget />

      <article className="dashboard-info-card dashboard-info-card-birthday">
        <div className="dashboard-birthday-card-header">
          <div className="dashboard-info-head">
            <span className="dashboard-info-kicker">BUK</span>
            <strong>Cumpleaños próximos</strong>
          </div>
          <svg className="dashboard-birthday-card-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
            <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2 1 2 1" />
            <path d="M2 21h20" />
            <path d="M7 8v3" />
            <path d="M12 8v3" />
            <path d="M17 8v3" />
            <path d="M7 4h.01" />
            <path d="M12 4h.01" />
            <path d="M17 4h.01" />
          </svg>
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
