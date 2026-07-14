import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { THEME_OPTIONS, type Theme } from '../theme';
import {
  UI_THEME_TRANSLATIONS,
  type UiThemeTranslations,
} from './ui-theme.translations';

const LANGUAGE_FALLBACKS: Record<string, string> = {
  ar: 'ar-SA',
  de: 'de-DE',
  en: 'en-US',
  es: 'es-MX',
  fr: 'fr-FR',
  hi: 'hi-IN',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  pt: 'pt-BR',
  ru: 'ru-RU',
  zh: 'zh-CN',
};

@Injectable({ providedIn: 'root' })
export class UiThemeI18nService {
  private readonly translate = inject(TranslateService);
  private readonly lang = signal(this.resolveLang(this.getInitialLang()));

  readonly texts = computed<UiThemeTranslations>(() => {
    const lang = this.lang();
    return UI_THEME_TRANSLATIONS[lang] ?? UI_THEME_TRANSLATIONS['en-US'];
  });

  readonly themeOptions = computed(() =>
    THEME_OPTIONS.map((option) => ({
      ...option,
      label: this.getThemeLabel(option.code),
    })),
  );

  constructor() {
    this.translate.onLangChange.subscribe((event) => {
      this.lang.set(this.resolveLang(event.lang));
    });
  }

  getThemeLabel(theme: Theme): string {
    return this.texts().UI_THEME.THEME[this.toThemeToken(theme)];
  }

  private getInitialLang(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'en-US';
  }

  private resolveLang(lang: string): string {
    if (UI_THEME_TRANSLATIONS[lang]) {
      return lang;
    }

    const normalized = lang.toLowerCase();
    const primary = normalized.split('-')[0];

    return LANGUAGE_FALLBACKS[primary] ?? 'en-US';
  }

  private toThemeToken(
    theme: Theme
  ): keyof UiThemeTranslations['UI_THEME']['THEME'] {
    switch (theme) {
      case 'system':
        return 'SYSTEM';
      case 'light':
        return 'LIGHT';
      case 'dark':
        return 'DARK';
      case 'warm-reading':
        return 'WARM_READING';
      case 'pop-rose':
        return 'POP_ROSE';
      case 'nocturne-violet':
        return 'NOCTURNE_VIOLET';
      case 'obsidian-red':
        return 'OBSIDIAN_RED';
      case 'terminal-green':
        return 'TERMINAL_GREEN';
      case 'mint-fresh':
        return 'MINT_FRESH';
      case 'silver-tech':
        return 'SILVER_TECH';
      case 'gold-luxe':
        return 'GOLD_LUXE';
    }
  }
}
