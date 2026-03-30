const DEFAULT_APP_BASE_URL = "http://localhost:3000";

function withProtocol(urlCandidate: string): string {
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(urlCandidate)) {
    return urlCandidate;
  }

  return `https://${urlCandidate}`;
}

export function resolveAppBaseUrl(rawBaseUrl?: string): URL {
  const candidate = rawBaseUrl?.trim();

  if (candidate) {
    try {
      const parsed = new URL(withProtocol(candidate));
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed;
      }
    } catch {
      // Ignore invalid base URL candidate and fallback below.
    }
  }

  return new URL(DEFAULT_APP_BASE_URL);
}
