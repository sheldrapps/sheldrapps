export function isValidApp(app) {
  return (
    typeof app?.appName === "string" &&
    app.appName.trim().length > 0 &&
    typeof app?.packageName === "string" &&
    app.packageName.trim().length > 0 &&
    typeof app?.icon === "string" &&
    app.icon.trim().length > 0 &&
    typeof app?.description === "string" &&
    app.description.trim().length > 0 &&
    typeof app?.playStoreUrl === "string" &&
    app.playStoreUrl.trim().length > 0
  );
}

export function isValidRecommendedApp(app) {
  return isValidApp(app);
}

export function filterRecommended(registry, currentPackageName) {
  const normalizedCurrent = String(currentPackageName || "")
    .trim()
    .toLowerCase();
  const validApps = (registry || []).filter(isValidApp);
  return validApps.filter(
    (app) => app.packageName.trim().toLowerCase() !== normalizedCurrent,
  );
}

export function filterRecommendedApps(registry, currentPackageName) {
  return filterRecommended(registry, currentPackageName);
}

export function hasRecommendedApps(registry, currentPackageName) {
  return filterRecommended(registry, currentPackageName).length > 0;
}

export function createCurrentPackageResolver(getInfo) {
  let cachedPromise = null;

  return async function resolveCurrentPackageName() {
    if (cachedPromise) {
      return cachedPromise;
    }

    cachedPromise = Promise.resolve()
      .then(() => getInfo())
      .then((info) => {
        const id = typeof info?.id === "string" ? info.id.trim() : "";
        return id;
      })
      .catch(() => "");

    return cachedPromise;
  };
}

export function buildHomeHeaderItems(hasRecommendedApps, labels = {}) {
  const appsLabel =
    typeof labels?.appsLabel === "string" && labels.appsLabel.trim().length > 0
      ? labels.appsLabel
      : typeof labels?.recommendedLabel === "string" &&
          labels.recommendedLabel.trim().length > 0
        ? labels.recommendedLabel
        : "Apps";
  const guideLabel =
    typeof labels?.guideLabel === "string" &&
    labels.guideLabel.trim().length > 0
      ? labels.guideLabel
      : typeof labels?.infoLabel === "string" &&
          labels.infoLabel.trim().length > 0
        ? labels.infoLabel
        : "Guide";

  return [
    ...(hasRecommendedApps
      ? [
          {
            id: "recommended",
            label: appsLabel,
            icon: "apps-outline",
          },
        ]
      : []),
    {
      id: "guide",
      label: guideLabel,
      icon: "help-circle-outline",
    },
  ];
}

export async function handleHomeHeaderAction(id, handlers) {
  if (id === "recommended") {
    handlers.closeInfo();
    await handlers.navigateToRecommended();
    return;
  }

  if (id === "guide" || id === "info") {
    handlers.toggleInfo();
  }
}

export async function openRecommendedApp(url, openUrl) {
  const normalizedUrl = typeof url === "string" ? url.trim() : "";
  if (!normalizedUrl) return;

  if (openUrl) {
    await openUrl(normalizedUrl);
    return;
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: normalizedUrl });
    return;
  } catch {
    // Fallback for environments where Capacitor Browser is not available.
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  }
}

function normalizeLocaleCandidate(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getDocumentLocale() {
  try {
    return normalizeLocaleCandidate(document?.documentElement?.lang);
  } catch {
    return "";
  }
}

async function getDeviceLocale() {
  try {
    const { Device } = await import("@capacitor/device");
    const tag = await Device.getLanguageTag();
    const localeTag = normalizeLocaleCandidate(tag?.value);
    if (localeTag) {
      return localeTag;
    }
  } catch {
    // Capacitor Device plugin may be unavailable on web/tests.
  }

  try {
    const { Device } = await import("@capacitor/device");
    const code = await Device.getLanguageCode();
    const localeCode = normalizeLocaleCandidate(code?.value);
    if (localeCode) {
      return localeCode;
    }
  } catch {
    // Capacitor Device plugin may be unavailable on web/tests.
  }

  return "";
}

function getNavigatorLocale() {
  try {
    return normalizeLocaleCandidate(
      navigator.languages?.[0] ?? navigator.language,
    );
  } catch {
    return "";
  }
}

function getIntlLocale() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return normalizeLocaleCandidate(locale);
  } catch {
    return "";
  }
}

export async function detectRuntimeLocale(preferredLocale) {
  const preferred = normalizeLocaleCandidate(preferredLocale);
  if (preferred) {
    return preferred;
  }

  const documentLocale = getDocumentLocale();
  if (documentLocale) {
    return documentLocale;
  }

  const deviceLocale = await getDeviceLocale();
  if (deviceLocale) {
    return deviceLocale;
  }

  const navigatorLocale = getNavigatorLocale();
  if (navigatorLocale) {
    return navigatorLocale;
  }

  return getIntlLocale();
}

export function resolveLocaleWithFallback(
  supportedLocales,
  preferredLocale,
  fallbackLocale,
) {
  const fallback = String(fallbackLocale || "").trim();
  const raw = String(preferredLocale ?? fallback).trim().toLowerCase();

  const supported = Array.isArray(supportedLocales) ? supportedLocales : [];
  const supportedMap = new Map(
    supported.map((locale) => [String(locale).toLowerCase(), String(locale)]),
  );

  if (supportedMap.has(raw)) {
    return supportedMap.get(raw);
  }

  const base = raw.split("-")[0];
  if (base) {
    for (const [normalized, original] of supportedMap.entries()) {
      if (normalized.split("-")[0] === base) {
        return original;
      }
    }
  }

  return supportedMap.get(fallback.toLowerCase()) || fallback;
}

export async function resolveLocaleWithFallbackAsync(
  supportedLocales,
  preferredLocale,
  fallbackLocale,
) {
  const detectedLocale = await detectRuntimeLocale(preferredLocale);
  return resolveLocaleWithFallback(
    supportedLocales,
    detectedLocale,
    fallbackLocale,
  );
}
