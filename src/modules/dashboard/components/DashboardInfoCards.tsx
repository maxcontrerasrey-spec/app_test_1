import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DashboardBirthdayItem, DashboardOperationalSummary } from "../types";
import { DashboardBirthdayCard } from "./DashboardBirthdayCard";
import { DashboardEconomicCard } from "./DashboardEconomicCard";
import { DashboardOperationalSummaryCard } from "./DashboardOperationalSummaryCard";
import { DashboardWeatherCard, type WeatherForecastDay } from "./DashboardWeatherCard";

type DashboardInfoCardsProps = {
  birthdays: DashboardBirthdayItem[];
  operationalSummary: DashboardOperationalSummary | null;
};

type WeatherState = {
  temperature: number | null;
  code: number | null;
  isLoading: boolean;
  dailyForecast: WeatherForecastDay[];
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
const WEATHER_REQUEST_TIMEOUT_MS = 8000;

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

function buildBigDataCloudIpGeolocationUrl() {
  return "https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=es";
}

function buildNominatimReverseGeocodingUrl(latitude: number, longitude: number) {
  return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=es`;
}

function formatCoordinateLabel(latitude: number, longitude: number) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "O"}`;
}

async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "AbortError"));
  }, timeoutMs);

  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort(parentSignal?.reason);

  if (parentSignal) {
    if (parentSignal.aborted) {
      abortFromParent();
    } else {
      parentSignal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

type CachedLocationPayload = {
  label: string;
  latitude: number;
  longitude: number;
  isFallback?: boolean;
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
    const latitude = typeof parsed?.latitude === "number" ? parsed.latitude : Number.NaN;
    const longitude = typeof parsed?.longitude === "number" ? parsed.longitude : Number.NaN;
    if (
      typeof parsed?.label !== "string" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      typeof parsed?.savedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - parsed.savedAt > LOCATION_CACHE_TTL_MS) {
      return null;
    }

    return {
      label: parsed.label,
      statusLabel: parsed.isFallback ? "Última ubicación aproximada" : "Última ubicación conocida",
      latitude,
      longitude,
      isResolved: true,
      isFallback: parsed.isFallback === true
    };
  } catch {
    return null;
  }
}

function persistBrowserLocation(
  label: string,
  latitude: number,
  longitude: number,
  isFallback: boolean
) {
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
        isFallback,
        savedAt: Date.now()
      } satisfies CachedLocationPayload)
    );
  } catch {
    // Best effort cache only.
  }
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
  latitude?: number | string;
  longitude?: number | string;
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

type IpFallbackLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

function parseFiniteCoordinate(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function parseGeoJsLocationLabel(payload: unknown) {
  const data = payload as
    | {
        city?: unknown;
        region?: unknown;
        country_code?: unknown;
        country?: unknown;
        latitude?: unknown;
        longitude?: unknown;
      }
    | null;

  if (!data) {
    return null;
  }

  const city =
    typeof data.city === "string" && data.city.trim()
      ? data.city.trim()
      : typeof data.region === "string" && data.region.trim()
        ? data.region.trim()
      : null;

  const countryCode =
    typeof data.country_code === "string" && data.country_code.trim()
      ? data.country_code.trim().toUpperCase()
      : typeof data.country === "string" && data.country.trim()
        ? data.country.trim().slice(0, 2).toUpperCase()
        : "CL";

  const latitude = parseFiniteCoordinate(data.latitude);
  const longitude = parseFiniteCoordinate(data.longitude);

  if (!city || latitude == null || longitude == null) {
    return null;
  }

  return {
    label: `${city}, ${countryCode}`,
    latitude,
    longitude
  } satisfies IpFallbackLocation;
}

async function fetchIpFallbackLocation(signal?: AbortSignal) {
  try {
    const response = await fetch(buildBigDataCloudIpGeolocationUrl(), { signal });
    if (response.ok) {
      const payload = (await response.json()) as ReverseGeocodingPayload | null;
      const label = formatLocationLabel(payload);
      const latitude = parseFiniteCoordinate(payload?.latitude);
      const longitude = parseFiniteCoordinate(payload?.longitude);

      if (label && latitude != null && longitude != null) {
        return {
          label,
          latitude,
          longitude
        } satisfies IpFallbackLocation;
      }
    }
  } catch {
    // Continue with the secondary provider.
  }

  try {
    const response = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal });
    if (!response.ok) {
      return null;
    }

    return parseGeoJsLocationLabel(await response.json());
  } catch {
    return null;
  }
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
  birthdays,
  operationalSummary
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
    code: null,
    isLoading: true,
    dailyForecast: []
  });
  const locationRef = useRef(location);
  const locationRequestInFlightRef = useRef(false);
  const reverseControllerRef = useRef<AbortController | null>(null);
  const activeLocationRequestIdRef = useRef(0);
  const activeWeatherRequestIdRef = useRef(0);

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
        persistBrowserLocation(label, latitude, longitude, false);
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
        persistBrowserLocation(label, latitude, longitude, false);
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
      const fallbackLocation = await fetchIpFallbackLocation();
      if (fallbackLocation) {
        persistBrowserLocation(
          fallbackLocation.label,
          fallbackLocation.latitude,
          fallbackLocation.longitude,
          true
        );
        setLocation({
          label: fallbackLocation.label,
          statusLabel: `Aproximada por red (${reasonLabel})`,
          latitude: fallbackLocation.latitude,
          longitude: fallbackLocation.longitude,
          isResolved: true,
          isFallback: true
        });
        return;
      }

      throw new Error("No fue posible resolver ubicación aproximada por red");
    } catch {
      setLocation({
        ...UNAVAILABLE_LOCATION,
        statusLabel: `${reasonLabel} · usando ubicación por defecto`
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
    const requestId = ++activeWeatherRequestIdRef.current;

    async function loadWeather() {
      if (location.latitude == null || location.longitude == null) {
        if (requestId === activeWeatherRequestIdRef.current) {
          setWeather((current) => ({
            ...current,
            isLoading: true
          }));
        }
        return;
      }

      try {
        const payload = await fetchJsonWithTimeout<{
          current?: {
            temperature_2m?: number;
            weather_code?: number;
          } | null;
          daily?: {
            time?: number[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            weather_code?: number[];
          } | null;
        }>(buildWeatherUrl(location.latitude, location.longitude), {
          signal: controller.signal
        }, WEATHER_REQUEST_TIMEOUT_MS);
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

        if (requestId === activeWeatherRequestIdRef.current && !controller.signal.aborted) {
          setWeather({
            temperature: typeof current?.temperature_2m === "number" ? current.temperature_2m : null,
            code: typeof current?.weather_code === "number" ? current.weather_code : null,
            isLoading: false,
            dailyForecast: nextDays
          });
        }
      } catch (_error) {
        if (controller.signal.aborted || requestId !== activeWeatherRequestIdRef.current) {
          return;
        }

        setWeather({
          temperature: null,
          code: null,
          isLoading: false,
          dailyForecast: []
        });
      }
    }

    if (requestId === activeWeatherRequestIdRef.current) {
      setWeather((current) => ({
        ...current,
        isLoading: true
      }));
    }
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
