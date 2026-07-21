import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from "@angular/core";
import { provideHttpClient } from "@angular/common/http";
import { provideRouter } from "@angular/router";
import {
  TranslateLoader,
  provideTranslateService,
  TranslateService,
} from "@ngx-translate/core";
import {
  TRANSLATE_HTTP_LOADER_CONFIG,
  TranslateHttpLoader,
} from "@ngx-translate/http-loader";
import { lastValueFrom } from "rxjs";

import { routes } from "./app.routes";

const LANGUAGE_STORAGE_KEY = "sheldrapps-web.lang";
const SUPPORTED_WEB_LOCALES = [
  "en-US",
  "es-MX",
  "de-DE",
  "fr-FR",
  "it-IT",
  "pt-BR",
  "ar-SA",
  "hi-IN",
  "ja-JP",
  "ko-KR",
  "ru-RU",
  "zh-CN",
  "zh-TW",
] as const;
type SupportedWebLocale = (typeof SUPPORTED_WEB_LOCALES)[number];

function createTranslateLoader(): TranslateHttpLoader {
  return new TranslateHttpLoader();
}

function normalizeLanguage(
  value: string | null | undefined,
): SupportedWebLocale | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  const exactMatch = SUPPORTED_WEB_LOCALES.find(
    (code) => code.toLowerCase() === normalized,
  );
  if (exactMatch) {
    return exactMatch;
  }

  if (normalized.startsWith("es")) {
    return "es-MX";
  }

  if (normalized.startsWith("en")) {
    return "en-US";
  }

  if (normalized.startsWith("de")) return "de-DE";
  if (normalized.startsWith("fr")) return "fr-FR";
  if (normalized.startsWith("it")) return "it-IT";
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("ar")) return "ar-SA";
  if (normalized.startsWith("hi")) return "hi-IN";
  if (normalized.startsWith("ja")) return "ja-JP";
  if (normalized.startsWith("ko")) return "ko-KR";
  if (normalized === "zh-tw") return "zh-TW";
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("ru")) return "ru-RU";

  return null;
}

function detectBrowserLanguage(): SupportedWebLocale {
  if (typeof window === "undefined") {
    return "en-US";
  }

  const queryLanguage = normalizeLanguage(
    new URLSearchParams(window.location.search).get("lang"),
  );
  if (queryLanguage) {
    return queryLanguage;
  }

  const storedLanguage = normalizeLanguage(
    window.localStorage.getItem(LANGUAGE_STORAGE_KEY),
  );
  if (storedLanguage) {
    return storedLanguage;
  }

  const browserLanguage =
    normalizeLanguage(
      window.navigator.languages?.[0] ?? window.navigator.language,
    ) ?? "en-US";

  return browserLanguage;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: TRANSLATE_HTTP_LOADER_CONFIG,
      useValue: { prefix: "./assets/i18n/", suffix: ".json" },
    },
    provideTranslateService({
      fallbackLang: "en-US",
      lang: "en-US",
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [],
      },
    }),
    provideAppInitializer(() => {
      const translate = inject(TranslateService);
      const language = detectBrowserLanguage();

      translate.setDefaultLang("en-US");
      document.documentElement.lang = language;

      translate.onLangChange.subscribe(({ lang }) => {
        document.documentElement.lang = lang;

        try {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
        } catch {
          // Ignore storage failures in non-persistent contexts.
        }
      });

      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      } catch {
        // Ignore storage failures in non-persistent contexts.
      }

      return lastValueFrom(translate.use(language));
    }),
  ],
};
