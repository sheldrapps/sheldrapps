# file-kit Agent Guide

`@sheldrapps/file-kit` centralizes filesystem/share operations for Angular + Capacitor apps through adapters and a single service API.

## Use This When

- Reading/writing files through Capacitor adapters.
- Generating safe filenames and MIME inference.
- Sharing files via platform share adapter.

## Do Not

- Build UI components here.
- Put app-specific flow logic in this package.
- Duplicate file APIs inside each app service.

## API Surface (Real Exports)

- `src/public-api.ts`
- `src/lib/file-kit.service.ts`
- `src/lib/providers.ts`
- `src/lib/types.ts`
- `src/lib/errors.ts`
- `src/lib/mime.ts`
- `src/lib/name.ts`
- `src/lib/adapters/filesystem.adapter.ts`
- `src/lib/adapters/share.adapter.ts`
- `src/lib/adapters/capacitor/capacitor-filesystem.adapter.ts`
- `src/lib/adapters/capacitor/capacitor-share.adapter.ts`

## App Consumption Pattern

- Provider wiring in app bootstrap:
  - `apps/cover-creator-for-kindle/src/main.ts`
  - `apps/epub-cover-changer/src/main.ts`
  - `apps/presupuesto-ninos/src/main.ts`
- Service usage examples:
  - `apps/cover-creator-for-kindle/src/app/services/file.service.ts`
  - `apps/epub-cover-changer/src/app/services/file.service.ts`

## Test Guidance

- No dedicated package-local test command is currently defined.
- Validate through workspace checks:
  - `pnpm test`
  - `pnpm lint`
