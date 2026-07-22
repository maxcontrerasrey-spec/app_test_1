import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildWeatherUrl,
  fetchIpFallbackLocation,
  fetchJsonWithTimeout,
  fetchReverseGeocodingPayloads,
  formatCoordinateLabel,
  INITIAL_LOCATION,
  isGeolocationError,
  persistBrowserLocation,
  pickFallbackGeolocationError,
  readCachedBrowserLocation,
  requestBrowserPositionWithHardTimeout,
  toGeolocationStatusLabel,
  UNAVAILABLE_LOCATION,
  WEATHER_REQUEST_TIMEOUT_MS,
  type LiveLocationState,
  type WeatherState
} from "../lib/dashboardWeather";

export function useDashboardWeather() {
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
        }>(
          buildWeatherUrl(location.latitude, location.longitude),
          {
            signal: controller.signal
          },
          WEATHER_REQUEST_TIMEOUT_MS
        );
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

  let weatherThemeClass = "";
  if (!weather.isLoading && weather.temperature !== null) {
    if (weather.temperature >= 26) {
      weatherThemeClass = " is-warm";
    } else if (weather.temperature <= 12) {
      weatherThemeClass = " is-cold";
    } else if (
      weather.code !== null &&
      [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weather.code)
    ) {
      weatherThemeClass = " is-rainy";
    }
  }

  return {
    location,
    weather,
    weatherThemeClass,
    requestBrowserLocation
  };
}
