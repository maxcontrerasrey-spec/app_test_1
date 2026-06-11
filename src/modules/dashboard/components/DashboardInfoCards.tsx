import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardBirthdayItem } from "../types";
import { DashboardEconomicCard } from "./DashboardEconomicCard";

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
  dailyForecast: { time: number; temperatureMax: number; temperatureMin: number; code: number }[];
};

type LiveLocationState = {
  label: string;
  statusLabel: string;
  latitude: number | null;
  longitude: number | null;
  isResolved: boolean;
  isFallback: boolean;
};

const INITIAL_LOCATION: LiveLocationState = {
  label: "Detectando ubicación",
  statusLabel: "Resolviendo ubicación...",
  latitude: null,
  longitude: null,
  isResolved: false,
  isFallback: false
};

const LOCATION_CACHE_KEY = "dashboard:weather:last-browser-location";
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

const UNAVAILABLE_LOCATION: LiveLocationState = {
  label: "Los Andes, CL",
  statusLabel: "Ubicación por defecto",
  latitude: -32.8338,
  longitude: -70.5972,
  isResolved: true,
  isFallback: true
};

function buildWeatherUrl(latitude: number, longitude: number) {
  return `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=5&timeformat=unixtime&timezone=America%2FSantiago`;
}

function buildBigDataCloudReverseGeocodingUrl(latitude: number, longitude: number) {
  return `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`;
}

function buildNominatimReverseGeocodingUrl(latitude: number, longitude: number) {
  return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=es`;
}

function formatCoordinateLabel(latitude: number, longitude: number) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "O"}`;
}

type CachedLocationPayload = {
  label: string;
  latitude: number;
  longitude: number;
  savedAt: number;
};

function readCachedBrowserLocation(): LiveLocationState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(LOCATION_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<CachedLocationPayload>;
    if (
      typeof parsed?.label !== "string" ||
      typeof parsed?.latitude !== "number" ||
      typeof parsed?.longitude !== "number" ||
      typeof parsed?.savedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > LOCATION_CACHE_TTL_MS) {
      return null;
    }

    return {
      label: parsed.label,
      statusLabel: "Última ubicación conocida",
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      isResolved: true,
      isFallback: false
    };
  } catch {
    return null;
  }
}

function persistBrowserLocation(label: string, latitude: number, longitude: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      LOCATION_CACHE_KEY,
      JSON.stringify({
        label,
        latitude,
        longitude,
        savedAt: Date.now()
      } satisfies CachedLocationPayload)
    );
  } catch {
    // Best effort cache only.
  }
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

type ReverseGeocodingAdministrativeArea = {
  name?: string;
  adminLevel?: number;
};

type ReverseGeocodingPayload = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryCode?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country_code?: string;
  };
  localityInfo?: {
    administrative?: ReverseGeocodingAdministrativeArea[];
  };
};

function findAdministrativeLocality(areas: ReverseGeocodingAdministrativeArea[] | undefined) {
  if (!Array.isArray(areas) || areas.length === 0) {
    return null;
  }

  const normalizedAreas = areas
    .map((area) => ({
      name: typeof area.name === "string" ? area.name.trim() : "",
      adminLevel: typeof area.adminLevel === "number" ? area.adminLevel : -1
    }))
    .filter((area) => area.name);

  if (normalizedAreas.length === 0) {
    return null;
  }

  const bestMatch = normalizedAreas
    .filter((area) => area.adminLevel >= 6)
    .sort((left, right) => right.adminLevel - left.adminLevel)[0];

  return bestMatch?.name ?? normalizedAreas[normalizedAreas.length - 1]?.name ?? null;
}

function formatLocationLabel(payload: unknown) {
  const data = payload as ReverseGeocodingPayload | null;
  if (!data) return null;

  const city =
    (typeof data.city === "string" && data.city.trim()) ||
    (typeof data.locality === "string" && data.locality.trim()) ||
    (typeof data.address?.city === "string" && data.address.city.trim()) ||
    (typeof data.address?.town === "string" && data.address.town.trim()) ||
    (typeof data.address?.village === "string" && data.address.village.trim()) ||
    (typeof data.address?.municipality === "string" && data.address.municipality.trim()) ||
    (typeof data.address?.county === "string" && data.address.county.trim()) ||
    findAdministrativeLocality(data.localityInfo?.administrative) ||
    (typeof data.address?.state === "string" && data.address.state.trim()) ||
    (typeof data.principalSubdivision === "string" && data.principalSubdivision.trim()) ||
    null;

  const countryCode =
    typeof data.countryCode === "string" && data.countryCode.trim()
      ? data.countryCode.trim().toUpperCase()
      : typeof data.address?.country_code === "string" && data.address.country_code.trim()
        ? data.address.country_code.trim().toUpperCase()
      : "CL";

  return city ? `${city}, ${countryCode}` : null;
}

function toGeolocationStatusLabel(error?: GeolocationPositionError | null) {
  if (!error) {
    return "Ubicación actual";
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "Permiso de ubicación denegado";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Ubicación no disponible";
  }

  if (error.code === error.TIMEOUT) {
    return "Tiempo de ubicación agotado";
  }

  return UNAVAILABLE_LOCATION.statusLabel;
}

function pickFallbackGeolocationError(errors: GeolocationPositionError[]) {
  if (errors.length === 0) {
    return null;
  }

  return (
    errors.find((error) => error.code === error.PERMISSION_DENIED) ??
    errors.find((error) => error.code === error.POSITION_UNAVAILABLE) ??
    errors.find((error) => error.code === error.TIMEOUT) ??
    errors[0]
  );
}

function createGeolocationTimeoutError(timeoutMs: number) {
  return {
    code: 3,
    message: `Geolocation timed out after ${timeoutMs}ms`,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  } as GeolocationPositionError;
}

function requestBrowserPositionWithHardTimeout(
  options: PositionOptions,
  timeoutMs: number
) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      reject(createGeolocationTimeoutError(timeoutMs));
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        resolve(position);
      },
      (error) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timer);
        reject(error);
      },
      options
    );
  });
}

async function fetchReverseGeocodingPayloads(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
) {
  const providers = [
    buildBigDataCloudReverseGeocodingUrl(latitude, longitude),
    buildNominatimReverseGeocodingUrl(latitude, longitude)
  ];

  for (const url of providers) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const label = formatLocationLabel(payload);
      if (label) {
        return label;
      }
    } catch {
      // Try next provider.
    }
  }

  return null;
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === "object" && error !== null && "code" in error;
}

export function DashboardInfoCards({
  pendingTasksCount,
  approvalTrackingCount,
  birthdays
}: DashboardInfoCardsProps) {
  const [birthdayIndex, setBirthdayIndex] = useState(0);
  const [location, setLocation] = useState<LiveLocationState>(() => {
    if (typeof window === "undefined") {
      return INITIAL_LOCATION;
    }

    return readCachedBrowserLocation() ?? INITIAL_LOCATION;
  });
  const [weather, setWeather] = useState<WeatherState>({
    temperature: null,
    temperatureMax: null,
    temperatureMin: null,
    code: null,
    isLoading: true,
    dailyForecast: []
  });
  const locationRef = useRef(location);
  const locationRequestInFlightRef = useRef(false);
  const reverseControllerRef = useRef<AbortController | null>(null);
  const activeLocationRequestIdRef = useRef(0);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const resolveLocationLabel = useCallback(async (latitude: number, longitude: number, statusLabel: string) => {
    const requestId = ++activeLocationRequestIdRef.current;
    reverseControllerRef.current?.abort();
    reverseControllerRef.current = new AbortController();

    try {
      const label =
        (await fetchReverseGeocodingPayloads(latitude, longitude, reverseControllerRef.current.signal)) ??
        formatCoordinateLabel(latitude, longitude);

      if (requestId === activeLocationRequestIdRef.current) {
        persistBrowserLocation(label, latitude, longitude);
        setLocation({
          label,
          statusLabel,
          latitude,
          longitude,
          isResolved: true,
          isFallback: false
        });
      }
    } catch (_error) {
      if (requestId === activeLocationRequestIdRef.current) {
        const label = formatCoordinateLabel(latitude, longitude);
        persistBrowserLocation(label, latitude, longitude);
        setLocation({
          label,
          statusLabel,
          latitude,
          longitude,
          isResolved: true,
          isFallback: false
        });
      }
    }
  }, []);

  const fetchIpFallback = useCallback(async (reasonLabel: string) => {
    const cachedLocation = readCachedBrowserLocation();
    if (cachedLocation) {
      setLocation({
        ...cachedLocation,
        statusLabel: `${cachedLocation.statusLabel} (${reasonLabel})`
      });
      return;
    }

    try {
      const response = await fetch("https://get.geojs.io/v1/ip/geo.json");
      const data = await response.json();
      if (
        data &&
        data.latitude &&
        data.longitude
      ) {
        setLocation({
          label: `${data.city || data.region}, ${data.country_code}`,
          statusLabel: `Aproximada por red (${reasonLabel})`,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          isResolved: true,
          isFallback: true
        });
        return;
      }

      throw new Error("Invalid IP location data");
    } catch (_error) {
      const errStr = _error instanceof Error ? _error.message : String(_error);
      setLocation({
        ...UNAVAILABLE_LOCATION,
        label: "Error: " + errStr.substring(0, 30),
        statusLabel: reasonLabel
      });
    }
  }, []);

  const requestBrowserLocation = useCallback(async () => {
    if (locationRequestInFlightRef.current) {
      return;
    }

    locationRequestInFlightRef.current = true;

    try {
      if (!navigator.geolocation || !window.isSecureContext) {
        await fetchIpFallback("Navegador sin geolocalización segura");
        return;
      }

      const currentLocation = locationRef.current;
      const hasUsableCachedLocation =
        currentLocation.latitude != null &&
        currentLocation.longitude != null &&
        !currentLocation.isFallback;

      setLocation((previous) =>
        hasUsableCachedLocation
          ? {
              ...previous,
              statusLabel: "Actualizando ubicación..."
            }
          : {
              ...INITIAL_LOCATION,
              statusLabel: "Resolviendo ubicación..."
            }
      );

      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "geolocation" });
          if (permission.state === "denied") {
            await fetchIpFallback("Permiso de ubicación denegado");
            return;
          }
        } catch {
          // Some browsers throw here even when geolocation works.
        }
      }

      const geolocationErrors: GeolocationPositionError[] = [];

      try {
        const fastPosition = await requestBrowserPositionWithHardTimeout(
          {
            enableHighAccuracy: false,
            timeout: 7000,
            maximumAge: 300000
          },
          8000
        );

        await resolveLocationLabel(
          fastPosition.coords.latitude,
          fastPosition.coords.longitude,
          "Ubicación actual"
        );
        return;
      } catch (error) {
        if (isGeolocationError(error)) {
          geolocationErrors.push(error);
          if (error.code === error.PERMISSION_DENIED) {
            await fetchIpFallback(toGeolocationStatusLabel(error));
            return;
          }
        }
      }

      try {
        const precisePosition = await requestBrowserPositionWithHardTimeout(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          },
          12000
        );

        await resolveLocationLabel(
          precisePosition.coords.latitude,
          precisePosition.coords.longitude,
          "Ubicación actual"
        );
        return;
      } catch (error) {
        if (isGeolocationError(error)) {
          geolocationErrors.push(error);
          if (error.code === error.PERMISSION_DENIED) {
            await fetchIpFallback(toGeolocationStatusLabel(error));
            return;
          }
        }
      }

      try {
        const relaxedPosition = await requestBrowserPositionWithHardTimeout(
          {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 1800000
        },
        14000
        );

        await resolveLocationLabel(
          relaxedPosition.coords.latitude,
          relaxedPosition.coords.longitude,
          "Ubicación actual"
        );
        return;
      } catch (error) {
        if (isGeolocationError(error)) {
          geolocationErrors.push(error);
        }
      }

      await fetchIpFallback(toGeolocationStatusLabel(pickFallbackGeolocationError(geolocationErrors)));
    } finally {
      locationRequestInFlightRef.current = false;
    }
  }, [fetchIpFallback, resolveLocationLabel]);

  useEffect(() => {
    void requestBrowserLocation();

    const retryOnFocus = () => {
      const currentLocation = locationRef.current;

      if (
        !currentLocation.isResolved ||
        currentLocation.isFallback ||
        currentLocation.statusLabel.startsWith("Última ubicación conocida")
      ) {
        void requestBrowserLocation();
      }
    };

    window.addEventListener("focus", retryOnFocus);

    return () => {
      reverseControllerRef.current?.abort();
      window.removeEventListener("focus", retryOnFocus);
    };
  }, [requestBrowserLocation]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadWeather() {
      if (location.latitude == null || location.longitude == null) {
        setWeather((current) => ({
          ...current,
          isLoading: true
        }));
        return;
      }

      try {
        const response = await fetch(buildWeatherUrl(location.latitude, location.longitude), {
          signal: controller.signal
        });
        const payload = await response.json();
        const current = payload?.current ?? null;
        const daily = payload?.daily ?? null;

        const nextDays: { time: number; temperatureMax: number; temperatureMin: number; code: number }[] = [];
        if (daily?.time && daily?.temperature_2m_max && daily?.temperature_2m_min && daily?.weather_code) {
          for (let i = 1; i < daily.time.length; i++) {
            nextDays.push({
              time: daily.time[i],
              temperatureMax: daily.temperature_2m_max[i],
              temperatureMin: daily.temperature_2m_min[i],
              code: daily.weather_code[i]
            });
            if (nextDays.length === 4) break;
          }
        }

        setWeather({
          temperature: typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
          temperatureMax: typeof daily?.temperature_2m_max?.[0] === "number" ? daily.temperature_2m_max[0] : null,
          temperatureMin: typeof daily?.temperature_2m_min?.[0] === "number" ? daily.temperature_2m_min[0] : null,
          code: typeof current?.weather_code === "number" ? current.weather_code : null,
          isLoading: false,
          dailyForecast: nextDays
        });
      } catch (_error) {
        setWeather({
          temperature: null,
          temperatureMax: null,
          temperatureMin: null,
          code: null,
          isLoading: false,
          dailyForecast: []
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
      <article className={`dashboard-info-card dashboard-info-card-weather${weatherThemeClass}`} style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '2.8rem', lineHeight: 1, color: '#3b82f6', display: 'flex' }}>
              {toWeatherIcon(weather.code, 48, 1.5)}
            </span>
            <span style={{ fontSize: '2.8rem', fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--title)' }}>
              {weather.isLoading || weather.temperature == null ? "--" : Math.round(weather.temperature)}°
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
            <strong style={{ fontSize: '0.85rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--title)', fontWeight: 600 }}>
              {location.label ? location.label.split(',')[0] : "UBICACIÓN"}
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', lineHeight: 1.2, marginTop: '2px' }}>
              {weather.isLoading ? "CARGANDO..." : toWeatherLabel(weather.code)}
            </span>
            {(location.isFallback || !location.isResolved) ? (
              <button
                type="button"
                className="dashboard-info-weather-action"
                style={{ fontSize: '0.65rem', marginTop: '2px', padding: 0 }}
                onClick={() => void requestBrowserLocation()}
              >
                Reintentar
              </button>
            ) : null}
          </div>
        </div>
        
        {weather.dailyForecast.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: 'auto' }}>
            {weather.dailyForecast.map((d, i) => {
              const date = new Date((d.time + 14400) * 1000); // offset to local timezone roughly
              const dayName = new Intl.DateTimeFormat("es-CL", { weekday: "short" }).format(date).toUpperCase();
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--title)' }}>{dayName}</span>
                  <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
                    {toWeatherIcon(d.code, 22, 1.8)}
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--title)' }}>{Math.round(d.temperatureMax)}°</span>/{Math.round(d.temperatureMin)}°
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>

      <article className="dashboard-info-card dashboard-info-card-birthday" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {nextBirthday ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
              {birthdays.length > 1 ? (
                <div className="dashboard-birthday-controls" aria-label="Navegación de cumpleaños">
                  <button type="button" className="dashboard-birthday-control" onClick={() => moveBirthday("prev")} aria-label="Cumpleañero anterior">‹</button>
                  <button type="button" className="dashboard-birthday-control" onClick={() => moveBirthday("next")} aria-label="Siguiente cumpleañero">›</button>
                </div>
              ) : null}
            </div>
            <div className="dashboard-birthday-summary" style={{ marginTop: 'auto' }}>
              <strong style={{ fontSize: '1rem', lineHeight: 1.2, fontWeight: 500 }}>{nextBirthday.full_name}</strong>
              <small style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                {nextBirthday.birthday_label} · <span style={{ color: 'var(--title)', fontWeight: 500 }}>{birthdaySummary}</span>
              </small>
            </div>
            {birthdays.length > 1 ? (
              <div className="dashboard-birthday-pagination" aria-label="Posición del cumpleañero" style={{ marginTop: '6px' }}>
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
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '8px' }}>
              <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
              <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2 1 2 1" />
              <path d="M2 21h20" />
            </svg>
            <span style={{ fontSize: '0.9rem' }}>No hay cumpleaños próximos</span>
          </div>
        )}
      </article>

      <DashboardEconomicCard />
    </section>
  );
}
