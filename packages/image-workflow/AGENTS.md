# image-workflow Agent Guide

`@sheldrapps/image-workflow` provides reusable image processing contracts and pipeline utilities, plus editor/cropper UI entrypoints for app integration.

## Use This When

- Implementing shared image validation/normalization/render pipeline.
- Reusing cropper modal/editor routes/session services across apps.
- Sharing editor i18n and panel infrastructure.

## Do Not

- Put app-specific screen orchestration here unless truly reusable.
- Duplicate generic pipeline logic inside app services.
- Store app settings directly in this package.

## API Surface (Real Exports)

- `src/public-api.ts`
- `src/editor/public-api.ts`
- Core pipeline exports from `src/lib/core/pipeline/*`
- UI export: `src/lib/ui/cropper/cover-cropper-modal.component.ts`
- Editor exports from `src/lib/editor/*` via editor entrypoint
- Capacitor secondary export: `src/lib/adapters/capacitor/public-api.ts`

## App Consumption Pattern

- Pipeline/service imports from `@sheldrapps/image-workflow`.
- Editor route/session/i18n imports from `@sheldrapps/image-workflow/editor`.
- Real references:
  - `apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts`
  - `apps/epub-cover-changer/src/app/pages/change/change.page.ts`
  - `apps/epub-cover-changer/src/app/app.routes.ts`

## Test Guidance

- Package-local test script is not defined in this package yet.
- Use workspace-level checks:
  - `pnpm test`
  - `pnpm lint`
