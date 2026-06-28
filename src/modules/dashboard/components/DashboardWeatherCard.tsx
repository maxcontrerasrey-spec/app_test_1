import { formatWeekdayShortLabel } from "../../../shared/lib/format";
import { SoftSurface } from "../../../shared/ui";

type WeatherForecastDay = {
  time: number;
  temperatureMax: number;
  temperatureMin: number;
  code: number;
};

type DashboardWeatherCardProps = {
  themeClass: string;
  isLoading: boolean;
  temperature: number | null;
  code: number | null;
  locationLabel: string;
  locationStatusLabel: string;
  dailyForecast: WeatherForecastDay[];
  showRetry: boolean;
  onRetry: () => void;
};

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

function toWeatherLabel(code: number | null) {
  if (code == null) return "Sin dato";
  if (code === 0) return "Despejado";
  if ([1, 2, 3].includes(code)) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if (RAIN_CODES.has(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Variable";
}

function toWeatherIcon(code: number | null, size = 30, strokeWidth = 1.8) {
  const defaultProps = {
    width: size.toString(),
    height: size.toString(),
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth.toString(),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  if (code == null) {
    return (
      <svg {...defaultProps}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  if (code === 0) {
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

  if (RAIN_CODES.has(code)) {
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

export function DashboardWeatherCard({
  themeClass,
  isLoading,
  temperature,
  code,
  locationLabel,
  locationStatusLabel,
  dailyForecast,
  showRetry,
  onRetry
}: DashboardWeatherCardProps) {
  const locationName = locationLabel ? locationLabel.split(",")[0] : "UBICACION";
  const statusText = isLoading || showRetry ? locationStatusLabel : toWeatherLabel(code);

  return (
    <SoftSurface
      as="article"
      className={`dashboard-info-card dashboard-info-card-weather${themeClass} dashboard-weather-card`}
      variant="raised"
    >
      <div className="dashboard-weather-card-main">
        <div className="dashboard-weather-card-temperature">
          <span className="dashboard-weather-card-icon">{toWeatherIcon(code, 48, 1.5)}</span>
          <span className="dashboard-weather-card-value">
            {isLoading || temperature == null ? "--" : Math.round(temperature)}°
          </span>
        </div>
        <div className="dashboard-weather-card-meta">
          <strong className="dashboard-weather-card-location">{locationName}</strong>
          <span className="dashboard-weather-card-status">
            {statusText}
          </span>
          {showRetry ? (
            <button type="button" className="dashboard-info-weather-action dashboard-weather-card-retry" onClick={onRetry}>
              Reintentar
            </button>
          ) : null}
        </div>
      </div>

      {dailyForecast.length > 0 ? (
        <div className="dashboard-weather-card-forecast">
          {dailyForecast.map((day) => {
            const date = new Date((day.time + 14400) * 1000);
            const dayName = formatWeekdayShortLabel(date);

            return (
              <div key={day.time} className="dashboard-weather-card-forecast-day">
                <span className="dashboard-weather-card-forecast-label">{dayName}</span>
                <span className="dashboard-weather-card-forecast-icon">{toWeatherIcon(day.code, 22, 1.8)}</span>
                <span className="dashboard-weather-card-forecast-range">
                  <span className="dashboard-weather-card-forecast-max">{Math.round(day.temperatureMax)}°</span>/
                  {Math.round(day.temperatureMin)}°
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </SoftSurface>
  );
}

export type { WeatherForecastDay };
