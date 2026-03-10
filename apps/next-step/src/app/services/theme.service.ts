import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import {
  NextStepSettings,
  NextStepTheme,
} from '../settings/next-step-settings.schema';

export type Theme = NextStepTheme;

export type ThemeOption = {
  code: Theme;
  labelKey: string;
};

export const THEME_OPTIONS: readonly ThemeOption[] = [
  { code: 'system', labelKey: 'SETTINGS.THEME_SYSTEM' },
  { code: 'light', labelKey: 'SETTINGS.THEME_LIGHT' },
  { code: 'dark', labelKey: 'SETTINGS.THEME_DARK' },
] as const;

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly settings = inject(SettingsStore<NextStepSettings>);
  private readonly document = inject(DOCUMENT);

  private mediaQuery: MediaQueryList | null = null;
  private mediaListener?: (event: MediaQueryListEvent) => void;
  private initialized = false;
  private mode: Theme = 'system';

  get currentTheme(): Theme {
    return this.mode;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.applyTheme(this.currentTheme);
      return;
    }

    await this.settings.load();
    this.bindSystemThemeListener();

    const storedTheme = this.settings.get().theme ?? 'system';
    this.mode = storedTheme;
    this.applyTheme(storedTheme);

    if (!this.settings.get().theme) {
      await this.settings.set({ theme: storedTheme });
    }

    this.initialized = true;
  }

  async setTheme(theme: Theme): Promise<void> {
    this.mode = theme;
    this.applyTheme(theme);
    await this.settings.set({ theme });
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
      if (this.mode === 'system') {
        this.applyResolvedTheme(event.matches ? 'dark' : 'light');
      }
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

  private applyTheme(theme: Theme): void {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }

    root.setAttribute('data-theme', theme);

    if (theme === 'system') {
      this.applyResolvedTheme(this.prefersDark() ? 'dark' : 'light');
      return;
    }

    this.applyResolvedTheme(theme);
  }

  private applyResolvedTheme(theme: 'light' | 'dark'): void {
    const root = this.document.documentElement;
    if (!root) {
      return;
    }

    root.classList.remove(
      'theme-light',
      'theme-dark',
      'app-theme-light',
      'app-theme-dark',
      'ion-palette-dark'
    );
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    root.style.colorScheme = theme;
  }

  private prefersDark(): boolean {
    if (!this.mediaQuery && typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    return this.mediaQuery?.matches ?? false;
  }
}
