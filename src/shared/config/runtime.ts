function sanitizeBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue.replace(/\/$/, "") : "";
}

export function getPublicAppBaseUrl() {
  const configuredUrl = sanitizeBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return sanitizeBaseUrl(window.location.origin);
}

export function buildPublicAppUrl(pathname: string) {
  const baseUrl = getPublicAppBaseUrl();

  if (!baseUrl) {
    return undefined;
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}
