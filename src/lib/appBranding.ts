const DEFAULT_APP_NAME = "Lifemetric";
const DEFAULT_FAVICON_URL = "/favicon.ico";

export function getPublicAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || DEFAULT_APP_NAME;
}

export function getPublicAppFaviconUrl() {
  return process.env.NEXT_PUBLIC_APP_FAVICON_URL?.trim() || DEFAULT_FAVICON_URL;
}
