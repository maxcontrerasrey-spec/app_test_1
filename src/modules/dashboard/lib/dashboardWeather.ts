import type { WeatherForecastDay } from "../components/DashboardWeatherCard";

export type WeatherState = {
  temperature: number | null;
  code: number | null;
  isLoading: boolean;
  dailyForecast: WeatherForecastDay[];
};

export type LiveLocationState = {
  label: string;
  statusLabel: string;
  latitude: number | null;
  longitude: number | null;
  isResolved: boolean;
  isFallback: boolean;
};

export const INITIAL_LOCATION: LiveLocationState = {
  label: "Detectando ubicación",
  statusLabel: "Resolviendo ubicación...",
  latitude: null,
  longitude: null,
  isResolved: false,
  isFallback: false
};

const LOCATION_CACHE_KEY = "dashboard:weather:last-browser-location";
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

export const WEATHER_REQUEST_TIMEOUT_MS = 8000;

export const UNAVAILABLE_LOCATION: LiveLocationState = {
  label: "Los Andes, CL",
  statusLabel: "Ubicación por defecto",
  latitude: -32.8338,
  longitude: -70.5972,
  isResolved: true,
  isFallback: true
};

export function buildWeatherUrl(latitude: number, longitude: number) {
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

export function formatCoordinateLabel(latitude: number, longitude: number) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "O"}`;
}

export async function fetchJsonWithTimeout<T>(
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

export function readCachedBrowserLocation(): LiveLocationState | null {
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

export function persistBrowserLocation(
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

export async function fetchIpFallbackLocation(signal?: AbortSignal) {
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

export function toGeolocationStatusLabel(error?: GeolocationPositionError | null) {
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

export function pickFallbackGeolocationError(errors: GeolocationPositionError[]) {
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

export function requestBrowserPositionWithHardTimeout(
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

export async function fetchReverseGeocodingPayloads(
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

export function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return typeof error === "object" && error !== null && "code" in error;
}
