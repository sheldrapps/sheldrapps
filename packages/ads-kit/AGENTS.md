# ads-kit Agent Guide

`@sheldrapps/ads-kit` encapsulates AdMob initialization, rewarded ads flow, consent handling, and provider wiring for Angular Capacitor apps.

## Use This When

- App needs rewarded ads and UMP consent flow.
- Ads unit configuration must be injected per environment/platform.
- Apps should consume one shared ads abstraction.

## Do Not

- Put app page UI logic in this package.
- Hardcode app-specific ad units in package source.
- Mix settings/file/image logic here.

## API Surface (Real Exports)

- `src/public-api.ts`
- `src/lib/types.ts`
- `src/lib/ads.service.ts`
- `src/lib/consent.service.ts`
- `src/lib/ads.providers.ts`
- `src/lib/adapters/platform.ts`

## App Consumption Pattern

- Provider wiring in app bootstrap:
  - `apps/cover-creator-for-kindle/src/main.ts`
  - `apps/epub-cover-changer/src/main.ts`
- App service re-export pattern:
  - `apps/cover-creator-for-kindle/src/app/services/ads.service.ts`
  - `apps/epub-cover-changer/src/app/services/ads.service.ts`

## Test Guidance

- No package-local test script is defined today.
- Validate through app unit tests + workspace checks:
  - `pnpm test`
  - `pnpm lint`
