# @sheldrapps/ads-kit

Reusable AdMob integration for Angular Capacitor apps.

## Features

- AdMob initialization and rewarded ads
- UMP consent management
- Platform detection (Android/iOS/Web)
- Environment-agnostic configuration
- TypeScript types included

## Installation

```bash
pnpm add @sheldrapps/ads-kit
```

## Usage

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAdsKit } from '@sheldrapps/ads-kit';

bootstrapApplication(AppComponent, {
  providers: [
    provideAdsKit({
      isTesting: false,
      units: {
        android: {
          test: { rewarded: 'ca-app-pub-3940256099942544/5224354917' },
          prod: { rewarded: 'ca-app-pub-1676607690625695/8384333921' }
        }
      }
    })
  ]
});
```

## API

### AdsService

- `init()`: Initialize AdMob (idempotent)
- `showRewarded()`: Show rewarded ad, returns Promise<boolean>

### ConsentService

- `gatherConsent()`: Request UMP consent
- `showPrivacyOptionsIfAvailable()`: Show privacy options form
- `state`: Get current consent state

## License

MIT
