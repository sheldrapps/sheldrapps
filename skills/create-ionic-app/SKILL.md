---
name: create-ionic-app
description: Create a new Ionic Angular app inside this monorepo with tabs baseline, settings integration through @sheldrapps/settings-kit, config.json persistence wiring pattern, and ui-theme integration. Use when adding a new app under apps/*.
---

# Create Ionic App (Monorepo Standard)

## Checklist

1. Create app folder under `apps/<new-app>`.
2. Add workspace dependencies in `apps/<new-app>/package.json`:
   - `@sheldrapps/settings-kit`
   - `@sheldrapps/ui-theme`
   - Add others only if needed (`file-kit`, `ads-kit`, `image-workflow`, `i18n-kit`).
3. Copy the standard app scripts block used in `epub-cover-changer` and `cover-creator-for-kindle` into `apps/<new-app>/package.json` scripts:
   - `ng`
   - `start`
   - `prebuild` (`node ../../scripts/ensure-stencil-entry.cjs && node ../../scripts/patch-capacitor-status-bar.cjs && node ../../scripts/patch-capacitor-admob.cjs`)
   - `build`
   - `watch`
   - `test`
   - `lint`
   - `assets:android`
   - `debugApk`
   - `releaseApk`
   - `bundleRelease`
   - Reference files:
     - `apps/epub-cover-changer/package.json`
     - `apps/cover-creator-for-kindle/package.json`
4. Add/update TS paths in app `tsconfig.json` and `tsconfig.app.json` using existing apps as reference:
   - `../../packages/settings-kit/src/public-api.ts`
   - `../../packages/ui-theme/src/index.ts`
   - `../../packages/ui-theme/styles/*`
5. Create tabs shell and route files following existing pattern:
   - `src/app/tabs/tabs.page.html`
   - `src/app/tabs/tabs.routes.ts`
6. Ensure Tab #3 is Settings when app has at least 3 tabs:
   - third `<ion-tab-button>` should map to settings tab id.
   - route path should include `settings`.
7. Define app settings schema in:
   - `src/app/settings/<app>-settings.schema.ts`
8. Wire settings kit in `src/main.ts`:
   - call `provideSettingsKit({ appId, schema, ... })`
   - use `ConfigJsonFileAdapter` for persistent `config.json` pattern (see below).
9. Wire ui-theme styles:
   - `src/global.scss` -> `@use "@sheldrapps/ui-theme/styles/index" as *;`
   - `src/theme/variables.scss` -> same baseline import.
10. Add app scripts in root `package.json` if needed (`dev:*`, `build:*`, `lint:*`).

## config.json Persistence Pattern

Use real wiring pattern from:

- `apps/cover-creator-for-kindle/src/main.ts`
- `apps/epub-cover-changer/src/main.ts`

Expected pieces:

- `ConfigJsonFileAdapter({ primaryKey: "<app>.settings", fallbackAdapter: new WebLocalStorageAdapter() })`
- optional legacy read cleanup with `CompositeStorageAdapter([new CapacitorPreferencesAdapter(), new WebLocalStorageAdapter()])`

If app intentionally does not use `ConfigJsonFileAdapter`, document that as a TODO in app bootstrap.

## Validation Steps

1. `pnpm i`
2. `pnpm --filter <new-app> start`
3. `pnpm --filter <new-app> lint`
4. `pnpm --filter <new-app> build`
5. `pnpm test`
6. `pnpm lint`
7. `pnpm build`
