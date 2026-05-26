import { Component, ElementRef, HostListener, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  THEME_OPTIONS,
  THEME_CLASS_NAMES,
  getThemeDefinition,
  normalizeAppThemeMode,
  resolveThemeMode,
  type AppThemeMode,
  type Theme,
  type ThemeOption,
} from '../../../../../../packages/ui-theme/src/lib/theme/theme.models';

type SupportedLocale =
  | 'en-US'
  | 'es-MX'
  | 'de-DE'
  | 'fr-FR'
  | 'it-IT'
  | 'pt-BR'
  | 'ar-SA'
  | 'hi-IN'
  | 'ja-JP'
  | 'ko-KR'
  | 'ru-RU'
  | 'zh-CN'
  | 'zh-TW';

type LanguageOption = {
  code: SupportedLocale;
  labelKey: string;
  flagClass: string;
};

@Component({
  selector: 'app-site-title-controls',
  standalone: true,
  imports: [NgClass, TranslateModule],
  templateUrl: './site-title-controls.component.html',
  styleUrl: './site-title-controls.component.scss'
})
export class SiteTitleControlsComponent implements OnInit {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly translate = inject(TranslateService);
  private readonly themeStorageKey = 'sheldrapps-web.theme';
  private readonly languageStorageKey = 'sheldrapps-web.lang';
  private systemThemeMediaQuery: MediaQueryList | null = null;
  private systemThemeListener?: (event: MediaQueryListEvent) => void;

  readonly themeOptions: readonly ThemeOption[] = THEME_OPTIONS;
  readonly languageOptions: readonly LanguageOption[] = [
    { code: 'en-US', labelKey: 'LANGUAGE.ENGLISH', flagClass: 'app-language-option__flag--us' },
    { code: 'es-MX', labelKey: 'LANGUAGE.SPANISH', flagClass: 'app-language-option__flag--mx' },
    { code: 'de-DE', labelKey: 'LANGUAGE.GERMAN', flagClass: 'app-language-option__flag--de' },
    { code: 'fr-FR', labelKey: 'LANGUAGE.FRENCH', flagClass: 'app-language-option__flag--fr' },
    { code: 'it-IT', labelKey: 'LANGUAGE.ITALIAN', flagClass: 'app-language-option__flag--it' },
    { code: 'pt-BR', labelKey: 'LANGUAGE.PORTUGUESE_BRAZIL', flagClass: 'app-language-option__flag--br' },
    { code: 'ar-SA', labelKey: 'LANGUAGE.ARABIC', flagClass: 'app-language-option__flag--sa' },
    { code: 'hi-IN', labelKey: 'LANGUAGE.HINDI', flagClass: 'app-language-option__flag--in' },
    { code: 'ja-JP', labelKey: 'LANGUAGE.JAPANESE', flagClass: 'app-language-option__flag--jp' },
    { code: 'ko-KR', labelKey: 'LANGUAGE.KOREAN', flagClass: 'app-language-option__flag--kr' },
    { code: 'ru-RU', labelKey: 'LANGUAGE.RUSSIAN', flagClass: 'app-language-option__flag--ru' },
    { code: 'zh-CN', labelKey: 'LANGUAGE.CHINESE_SIMPLIFIED', flagClass: 'app-language-option__flag--cn' },
    { code: 'zh-TW', labelKey: 'LANGUAGE.CHINESE_TRADITIONAL', flagClass: 'app-language-option__flag--tw' },
  ];

  selectedTheme: AppThemeMode = 'system';
  selectedLanguage: SupportedLocale = 'en-US';
  isLanguageMenuOpen = false;

  get currentLanguageFlagClass(): string {
    const option = this.languageOptions.find((lang) => lang.code === this.selectedLanguage);
    return option?.flagClass ?? 'app-language-option__flag--us';
  }

  get currentLanguageOption(): LanguageOption {
    return this.languageOptions.find((lang) => lang.code === this.selectedLanguage) ?? this.languageOptions[0];
  }

  ngOnInit(): void {
    this.initializeTheme();
    this.initializeLanguage();
  }

  onThemeChange(theme: string): void {
    const normalizedTheme = normalizeAppThemeMode(theme) ?? 'system';
    this.selectedTheme = normalizedTheme;
    this.applyTheme(normalizedTheme, true);
  }

  onLanguageChange(language: string): void {
    const normalizedLanguage = this.normalizeLanguage(language);
    this.selectedLanguage = normalizedLanguage;
    this.applyLanguage(normalizedLanguage, true);
    this.isLanguageMenuOpen = false;
  }

  toggleLanguageMenu(): void {
    this.isLanguageMenuOpen = !this.isLanguageMenuOpen;
  }

  selectLanguage(code: SupportedLocale): void {
    this.onLanguageChange(code);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isLanguageMenuOpen) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && this.hostElement.nativeElement.contains(target)) {
      return;
    }

    this.isLanguageMenuOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.isLanguageMenuOpen = false;
  }

  private initializeTheme(): void {
    const savedTheme = normalizeAppThemeMode(this.readStorage(this.themeStorageKey)) ?? 'system';
    this.selectedTheme = savedTheme;
    this.applyTheme(savedTheme, false);
    this.bindSystemThemeListener();
  }

  private initializeLanguage(): void {
    const savedLanguage = this.normalizeLanguage(this.readStorage(this.languageStorageKey) ?? '');
    this.selectedLanguage = savedLanguage;
    this.applyLanguage(savedLanguage, false);
  }

  private applyTheme(theme: Theme, persist: boolean): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    const prefersDark = this.prefersDark();
    const resolvedTheme = resolveThemeMode(theme, prefersDark ? 'dark' : 'light');
    const definition = getThemeDefinition(resolvedTheme);

    root.classList.remove(...THEME_CLASS_NAMES);
    root.classList.add(definition.className);
    root.style.colorScheme = definition.appearance;
    root.setAttribute('data-resolved-theme', resolvedTheme);
    root.setAttribute('data-resolved-appearance', definition.appearance);

    if (persist) {
      this.writeStorage(this.themeStorageKey, theme);
    }
  }

  private applyLanguage(language: SupportedLocale, persist: boolean): void {
    document.documentElement.lang = language;
    void this.translate.use(language);

    if (persist) {
      this.writeStorage(this.languageStorageKey, language);
    }
  }

  private bindSystemThemeListener(): void {
    if (typeof window === 'undefined' || this.systemThemeMediaQuery) {
      return;
    }

    this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.systemThemeListener = () => {
      if (this.selectedTheme !== 'system') {
        return;
      }

      this.applyTheme('system', false);
    };

    if (typeof this.systemThemeMediaQuery.addEventListener === 'function') {
      this.systemThemeMediaQuery.addEventListener('change', this.systemThemeListener);
      return;
    }

    this.systemThemeMediaQuery.addListener(this.systemThemeListener);
  }

  private prefersDark(): boolean {
    if (!this.systemThemeMediaQuery && typeof window !== 'undefined') {
      this.systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    return this.systemThemeMediaQuery?.matches ?? false;
  }

  private normalizeLanguage(value: string): SupportedLocale {
    switch (value) {
      case 'es-MX':
      case 'de-DE':
      case 'fr-FR':
      case 'it-IT':
      case 'pt-BR':
      case 'ar-SA':
      case 'hi-IN':
      case 'ja-JP':
      case 'ko-KR':
      case 'ru-RU':
      case 'zh-CN':
      case 'zh-TW':
        return value;
      default:
        return 'en-US';
    }
  }

  private readStorage(key: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures in constrained environments.
    }
  }
}
