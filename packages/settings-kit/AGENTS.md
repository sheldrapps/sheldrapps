# settings-kit Agent Guide

`@sheldrapps/settings-kit` is the reusable persistence layer for app settings: typed schema, defaults hydration, versioned migrations, and pluggable storage adapters.

## Use This When

- App settings must be loaded/saved with a schema and defaults.
- Legacy key migration is needed.
- Storage backend should be swappable (`Preferences`, `localStorage`, `config.json`, composite fallback).

## Do Not

- Put UI/tab logic here.
- Put app-specific defaults for one app here (define app schemas in each app).
- Add direct routing/component coupling.

## API Surface (Real Exports)

- `src/public-api.ts`
- `src/lib/providers.ts`
- `src/lib/settings-store/settings.store.ts`
- `src/lib/storage/storage.adapter.ts`
- `src/lib/storage/web-localstorage.adapter.ts`
- `src/lib/storage/capacitor-preferences.adapter.ts`
- `src/lib/storage/config-json-file.adapter.ts`
- `src/lib/storage/composite-storage.adapter.ts`
- `src/lib/types.ts`

## App Consumption Pattern

- Provider wiring in app bootstrap:
  - `apps/cover-creator-for-kindle/src/main.ts`
  - `apps/epub-cover-changer/src/main.ts`
  - `apps/presupuesto-ninos/src/main.ts`
- Typical imports:
  - `provideSettingsKit`
  - `SettingsStore<T>`
  - storage adapters from `@sheldrapps/settings-kit`

## Test Guidance

- Contract/guardrail tests:
  - `pnpm test`
  - files under `tools/settings-kit/`
- Note: package-local runtime unit test runner is not implemented as a standalone script in this package yet.
  - TODO: define `packages/settings-kit` dedicated unit runner if needed.
