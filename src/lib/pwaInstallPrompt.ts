export function isMobileOperatingSystem(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}

function isKnownAlternativeAndroidBrowser(userAgent: string): boolean {
  return /(EdgA|OPR|Brave|SamsungBrowser|YaBrowser|UCBrowser|DuckDuckGo)/i.test(userAgent);
}

export function isGoogleChromeOnAndroid(userAgent: string, vendor: string): boolean {
  const isAndroid = /Android/i.test(userAgent);
  const hasChromeToken = /Chrome\/\d+/i.test(userAgent);
  const hasAlternativeBrowserToken = isKnownAlternativeAndroidBrowser(userAgent);
  const isGoogleVendor = /Google Inc\./i.test(vendor);

  return isAndroid && hasChromeToken && isGoogleVendor && !hasAlternativeBrowserToken;
}

export function isAppRunningStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  const isStandaloneNavigator = typeof navigatorWithStandalone.standalone === 'boolean' && navigatorWithStandalone.standalone;

  return isStandaloneMedia || isStandaloneNavigator;
}

export function shouldShowPwaInstallHint(userAgent: string, vendor: string): boolean {
  if (!isMobileOperatingSystem(userAgent)) {
    return false;
  }

  if (isAppRunningStandalone()) {
    return false;
  }

  return !isGoogleChromeOnAndroid(userAgent, vendor);
}
