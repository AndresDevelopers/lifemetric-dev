const DEFAULT_APP_NAME = "Lifemetric";
const DEFAULT_APP_ICON_URL = "/favicon.ico";
const DEFAULT_FAVICON_URL = "/favicon.ico";

export function getPublicAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME;
}

export function getPublicAppIconUrl() {
  return process.env.NEXT_PUBLIC_APP_ICON_URL?.trim() || DEFAULT_APP_ICON_URL;
}

export function getPublicAppFaviconUrl() {
  return process.env.NEXT_PUBLIC_APP_FAVICON_URL?.trim() || DEFAULT_FAVICON_URL;
}
