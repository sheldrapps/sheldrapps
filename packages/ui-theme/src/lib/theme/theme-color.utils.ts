export const THEME_ACCENT_COLOR_FALLBACK =
  "var(--app-accent-fallback-color, var(--ion-color-primary, #64748B))";

export const THEME_ACCENT_BORDER_FALLBACK =
  "var(--app-accent-border-fallback, rgba(var(--ion-color-primary-rgb), 0.68))";

export const THEME_ACCENT_BACKGROUND_FALLBACK =
  "var(--app-accent-background-fallback, rgba(var(--ion-color-primary-rgb), 0.12))";

export const THEME_ACCENT_SHADOW_FALLBACK =
  "var(--app-accent-shadow-fallback, rgba(var(--ion-color-primary-rgb), 0.18))";

function normalizeHexColor(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const hex = normalized.startsWith("#") ? normalized.slice(1) : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  return `#${hex}`;
}

export function resolveThemeAccentColor(
  value: string | null | undefined,
  fallback = THEME_ACCENT_COLOR_FALLBACK
): string {
  return normalizeHexColor(value) ?? fallback;
}

export function withThemeAlpha(
  value: string | null | undefined,
  alpha: number,
  fallback = THEME_ACCENT_BACKGROUND_FALLBACK
): string {
  const normalized = normalizeHexColor(value);
  if (!normalized) {
    return fallback;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return fallback;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
