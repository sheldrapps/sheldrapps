export type ThemeId =
  | 'light'
  | 'dark'
  | 'warm-reading'
  | 'pop-rose'
  | 'nocturne-violet'
  | 'obsidian-red'
  | 'terminal-green'
  | 'mint-fresh'
  | 'silver-tech'
  | 'gold-luxe';

export type AppThemeMode = 'system' | ThemeId;
export type Theme = AppThemeMode;
export type ResolvedTheme = ThemeId;
export type ThemeAppearance = 'light' | 'dark';

export type ThemeOption = {
  code: Theme;
  labelKey: string;
};

export type ThemeDefinition = {
  id: ThemeId;
  labelKey: string;
  className: string;
  appearance: ThemeAppearance;
};

export type ThemePreviewTokens = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  border: string;
  toolbar: string;
};

export const THEME_DEFINITIONS: readonly ThemeDefinition[] = [
  {
    id: 'light',
    labelKey: 'UI_THEME.THEME.LIGHT',
    className: 'theme-light',
    appearance: 'light',
  },
  {
    id: 'dark',
    labelKey: 'UI_THEME.THEME.DARK',
    className: 'theme-dark',
    appearance: 'dark',
  },
  {
    id: 'warm-reading',
    labelKey: 'UI_THEME.THEME.WARM_READING',
    className: 'theme-warm-reading',
    appearance: 'light',
  },
  {
    id: 'pop-rose',
    labelKey: 'UI_THEME.THEME.POP_ROSE',
    className: 'theme-pop-rose',
    appearance: 'light',
  },
  {
    id: 'nocturne-violet',
    labelKey: 'UI_THEME.THEME.NOCTURNE_VIOLET',
    className: 'theme-nocturne-violet',
    appearance: 'dark',
  },
  {
    id: 'obsidian-red',
    labelKey: 'UI_THEME.THEME.OBSIDIAN_RED',
    className: 'theme-obsidian-red',
    appearance: 'dark',
  },
  {
    id: 'terminal-green',
    labelKey: 'UI_THEME.THEME.TERMINAL_GREEN',
    className: 'theme-terminal-green',
    appearance: 'dark',
  },
  {
    id: 'mint-fresh',
    labelKey: 'UI_THEME.THEME.MINT_FRESH',
    className: 'theme-mint-fresh',
    appearance: 'light',
  },
  {
    id: 'silver-tech',
    labelKey: 'UI_THEME.THEME.SILVER_TECH',
    className: 'theme-silver-tech',
    appearance: 'dark',
  },
  {
    id: 'gold-luxe',
    labelKey: 'UI_THEME.THEME.GOLD_LUXE',
    className: 'theme-gold-luxe',
    appearance: 'dark',
  },
] as const;

const THEME_IDS: ReadonlySet<string> = new Set(
  THEME_DEFINITIONS.map((theme) => theme.id)
);

const THEME_DEFINITION_MAP = THEME_DEFINITIONS.reduce(
  (acc, theme) => {
    acc[theme.id] = theme;
    return acc;
  },
  {} as Record<ThemeId, ThemeDefinition>
);

export const THEME_CLASS_NAMES: readonly string[] = THEME_DEFINITIONS.map(
  (theme) => theme.className
);

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { code: 'system', labelKey: 'UI_THEME.THEME.SYSTEM' },
  ...THEME_DEFINITIONS.map(({ id, labelKey }) => ({ code: id, labelKey })),
] as const;

export function getThemeLabelKey(theme: Theme | null | undefined): string {
  return (
    THEME_OPTIONS.find((option) => option.code === theme)?.labelKey ??
    THEME_OPTIONS[0].labelKey
  );
}

export const THEME_PREVIEW_TOKENS: Readonly<Record<ThemeId, ThemePreviewTokens>> = {
  light: {
    background: '#f4f6fb',
    surface: '#ffffff',
    text: '#15233b',
    muted: '#55657d',
    primary: '#2f66d0',
    border: 'rgba(21, 35, 59, 0.12)',
    toolbar: '#ffffff',
  },
  dark: {
    background: '#121316',
    surface: '#1f2125',
    text: '#e8ecf3',
    muted: '#a7adba',
    primary: '#7e9fe0',
    border: 'rgba(167, 173, 186, 0.2)',
    toolbar: '#1f2125',
  },
  'warm-reading': {
    background: '#efe2d0',
    surface: '#fbf1e1',
    text: '#342216',
    muted: '#695340',
    primary: '#af6a2f',
    border: 'rgba(52, 34, 22, 0.14)',
    toolbar: '#fbf1e1',
  },
  'pop-rose': {
    background: '#fff5f8',
    surface: '#ffffff',
    text: '#2b1f25',
    muted: '#7a5a6a',
    primary: '#e0218a',
    border: 'rgba(224, 33, 138, 0.14)',
    toolbar: '#ffe4ee',
  },
  'nocturne-violet': {
    background: '#05030a',
    surface: '#151022',
    text: '#f3eaff',
    muted: '#b8a8d9',
    primary: '#8a2cff',
    border: 'rgba(138, 44, 255, 0.2)',
    toolbar: '#1a1330',
  },
  'obsidian-red': {
    background: '#080607',
    surface: '#171012',
    text: '#f7eef1',
    muted: '#c9a5ad',
    primary: '#ff3158',
    border: 'rgba(255, 49, 88, 0.18)',
    toolbar: '#1b0e12',
  },
  'terminal-green': {
    background: '#050d09',
    surface: '#0b1a12',
    text: '#e8fff0',
    muted: '#8fd9aa',
    primary: '#39ff88',
    border: 'rgba(57, 255, 136, 0.18)',
    toolbar: '#0b1f15',
  },
  'mint-fresh': {
    background: '#eefaf5',
    surface: '#ffffff',
    text: '#1f2d2a',
    muted: '#5f7f77',
    primary: '#4cbf9f',
    border: 'rgba(76, 191, 159, 0.18)',
    toolbar: '#dff5ec',
  },
  'silver-tech': {
    background: '#0e0f11',
    surface: '#1a1c20',
    text: '#f1f3f5',
    muted: '#a6abb3',
    primary: '#cfd3da',
    border: 'rgba(207, 211, 218, 0.18)',
    toolbar: '#181a1e',
  },
  'gold-luxe': {
    background: '#0c0a07',
    surface: '#17130e',
    text: '#f8f3e6',
    muted: '#cbbd8b',
    primary: '#d4af37',
    border: 'rgba(212, 175, 55, 0.25)',
    toolbar: '#1c150f',
  },
} as const;

export function isThemeId(value: string): value is ThemeId {
  return THEME_IDS.has(value);
}

export function isAppThemeMode(value: string): value is AppThemeMode {
  return value === 'system' || isThemeId(value);
}

export function normalizeAppThemeMode(value: unknown): AppThemeMode | undefined {
  return typeof value === 'string' && isAppThemeMode(value) ? value : undefined;
}

export function getThemeDefinition(theme: ResolvedTheme): ThemeDefinition {
  return THEME_DEFINITION_MAP[theme];
}

export function resolveSystemTheme(
  appearance: ThemeAppearance
): ResolvedTheme {
  return appearance === 'dark' ? 'dark' : 'light';
}

export function resolveThemeMode(
  theme: Theme,
  appearance: ThemeAppearance
): ResolvedTheme {
  return theme === 'system' ? resolveSystemTheme(appearance) : theme;
}

export function getThemePreviewTokens(
  theme: Theme,
  appearance: ThemeAppearance
): ThemePreviewTokens {
  const resolvedTheme = resolveThemeMode(theme, appearance);
  return THEME_PREVIEW_TOKENS[resolvedTheme];
}
