import type { Locale } from "@/lib/i18n";

type ScanStatusMessages = {
  scanning: string;
  blockedPrefix: string;
  fallbackPrefix: string;
  successPrefix: string;
};

type ScanApiResponse = {
  allowed: boolean;
  mode: "scanned" | "skipped" | "error";
  message: string;
};

export async function guardFileUploadWithVirusTotal(file: File, locale: Locale, status: ScanStatusMessages): Promise<boolean> {
  try {
    const payload = new FormData();
    payload.append("file", file);
    payload.append("locale", locale);

    const response = await fetch("/api/security/scan-file", {
      method: "POST",
      body: payload,
    });

    if (!response.ok) return true;

    const result = (await response.json()) as ScanApiResponse;

    if (!result.allowed) {
      alert(`${status.blockedPrefix} ${result.message}`.trim());
      return false;
    }
    return true;
  } catch {
    return true;
  }
}
