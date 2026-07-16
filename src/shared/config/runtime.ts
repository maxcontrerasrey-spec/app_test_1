function sanitizeBaseUrl(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue.replace(/\/$/, "") : "";
}

const DEFAULT_PUBLIC_APP_BASE_URL = "https://gestion.busesjm.cl";

export function getPublicAppBaseUrl() {
  const configuredUrl = sanitizeBaseUrl(import.meta.env.VITE_PUBLIC_APP_URL);

  if (configuredUrl && !configuredUrl.includes("pages.dev")) {
    return configuredUrl;
  }

  return DEFAULT_PUBLIC_APP_BASE_URL;
}

export function buildPublicAppUrl(pathname: string) {
  const baseUrl = getPublicAppBaseUrl();

  if (!baseUrl) {
    return undefined;
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}
