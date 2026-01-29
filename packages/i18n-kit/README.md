# @sheldrapps/i18n-kit

Reusable i18n kit for Angular applications with language detection, persistence, and Capacitor integration.

## Features

- 🌍 **Language Detection**: Automatic detection from device or browser
- 💾 **Persistence**: Save user language preference
- 🔄 **Normalization**: Map language codes to supported variants (es → es-MX)
- 📦 **Standalone API**: Providers-based setup
- ⚙️ **Configurable**: Per-app customization
- 🚀 **Capacitor Ready**: Device API integration with fallback

## Installation

```bash
npm install @sheldrapps/i18n-kit
```

## Usage

In your `main.ts`:

```typescript
import { provideI18nKit } from '@sheldrapps/i18n-kit';

bootstrapApplication(AppComponent, {
  providers: [
    provideI18nKit({
      defaultLang: 'es-MX',
      fallbackLang: 'en-US',
      supportedLangs: ['es-MX', 'en-US', 'de-DE'],
      loader: {
        prefix: './assets/i18n/',
        suffix: '.json'
      },
      normalizationMap: {
        es: 'es-MX',
        en: 'en-US',
        de: 'de-DE'
      }
    })
  ]
});
```

In your component:

```typescript
import { LanguageService } from '@sheldrapps/i18n-kit';

export class MyComponent {
  constructor(public lang: LanguageService) {}

  async ngOnInit() {
    await this.lang.init();
  }

  changeLang(newLang: string) {
    this.lang.set(newLang);
  }
}
```

## Configuration

### LanguageConfig

```typescript
interface LanguageConfig {
  defaultLang: string;              // Default language (e.g., 'es-MX')
  fallbackLang: string;             // Fallback if translation missing
  supportedLangs: string[];         // Supported language codes
  storageKey?: string;              // localStorage key (default: 'lang')
  loader: {
    prefix: string;                 // Path prefix for files
    suffix: string;                 // File extension
  };
  normalizationMap?: Record<string, string>; // lang code mapping
  preferSaved?: boolean;            // Prefer saved lang over system (default: true)
}
```

## Architecture

```
Core (no deps except @ngx-translate):
- types.ts
- language.service.ts
- language-normalizer.ts
- storage.ts
- translate.providers.ts

Adapters (optional Capacitor):
- device-lang.ts
```

## License

MIT
