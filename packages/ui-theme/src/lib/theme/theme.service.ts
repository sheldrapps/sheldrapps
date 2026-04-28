import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { EdgeToEdgeService } from '../edge-to-edge';
import {
  THEME_CLASS_NAMES,
  getThemeDefinition,
  normalizeAppThemeMode,
  resolveThemeMode,
  type AppThemeMode,
  type ResolvedTheme,
  type Theme,
} from './theme.models';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly settings = inject(SettingsStore<{ theme?: AppThemeMode }>);
  private readonly document = inject(DOCUMENT);
  private readonly edgeToEdge = inject(EdgeToEdgeService);

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener?: (event: MediaQueryListEvent) => void;
  private initialized = false;
  private mode: Theme = 'system';

  get currentTheme(): Theme {
    return this.mode;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      await this.applyTheme(this.mode);
      return;
    }

    await this.settings.load();
    this.bindSystemThemeListener();

    const storedTheme = normalizeAppThemeMode(this.settings.get().theme) ?? 'system';
    this.mode = storedTheme;
    await this.applyTheme(storedTheme);

    if (this.settings.get().theme !== storedTheme) {
      await this.settings.set({ theme: storedTheme });
    }

    this.initialized = true;
  }

  async setTheme(theme: Theme): Promise<void> {
    const normalizedTheme = normalizeAppThemeMode(theme) ?? 'system';
    this.mode = normalizedTheme;
    await this.applyTheme(normalizedTheme);
    await this.settings.set({ theme: normalizedTheme });
  }

  async previewTheme(theme: Theme): Promise<void> {
    const normalizedTheme = normalizeAppThemeMode(theme) ?? 'system';
    await this.applyTheme(normalizedTheme);
  }

  async restorePersistedTheme(): Promise<void> {
    await this.applyTheme(this.mode);
  }

  ngOnDestroy(): void {
    this.unbindSystemThemeListener();
  }

  private bindSystemThemeListener(): void {
    if (typeof window === 'undefined' || this.mediaQuery) {
      return;
    }

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaListener = (event: MediaQueryListEvent) => {
      if (this.mode !== 'system') {
        return;
      }

      const resolvedTheme = this.resolveTheme(this.mode, event.matches);
      this.applyResolvedTheme(resolvedTheme);
      void this.syncSystemBars(resolvedTheme);
    };

    if (typeof this.mediaQuery.addEventListener === 'function') {
      this.mediaQuery.addEventListener('change', this.mediaListener);
      return;
    }

    this.mediaQuery.addListener(this.mediaListener);
  }

  private unbindSystemThemeListener(): void {
    if (!this.mediaQuery || !this.mediaListener) {
      return;
    }

    if (typeof this.mediaQuery.removeEventListener === 'function') {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    } else {
      this.mediaQuery.removeListener(this.mediaListener);
    }
  }

  private async applyTheme(theme: Theme): Promise<void> {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute('data-theme', theme);

    const resolvedTheme = this.resolveTheme(theme);

    this.applyResolvedTheme(resolvedTheme);
    await this.syncSystemBars(resolvedTheme);
  }

  private applyResolvedTheme(theme: ResolvedTheme): void {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }

    root.classList.remove(
      ...THEME_CLASS_NAMES,
      'app-theme-light',
      'app-theme-dark',
      'ion-palette-dark'
    );
    const definition = getThemeDefinition(theme);
    root.classList.add(definition.className);
    root.style.colorScheme = definition.appearance;
    root.setAttribute('data-resolved-theme', theme);
    root.setAttribute('data-resolved-appearance', definition.appearance);
  }

  private async syncSystemBars(theme: ResolvedTheme): Promise<void> {
    const definition = getThemeDefinition(theme);
    const iconTone = definition.appearance === 'dark' ? 'light' : 'dark';
    await this.edgeToEdge.setSystemBarAppearance({
      statusBarIcons: iconTone,
      navBarIcons: iconTone,
    });
  }

  private resolveTheme(
    theme: Theme,
    prefersDark = this.prefersDark()
  ): ResolvedTheme {
    return resolveThemeMode(theme, prefersDark ? 'dark' : 'light');
  }

  private prefersDark(): boolean {
    if (!this.mediaQuery && typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    return this.mediaQuery?.matches ?? false;
  }
}
