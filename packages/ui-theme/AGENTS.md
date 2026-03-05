# ui-theme Agent Guide

`@sheldrapps/ui-theme` is the shared design system package: reusable Angular UI components, edge-to-edge behavior service, and shared SCSS/style assets used by apps and `image-workflow`.

## Use This When

- A UI component should be reusable across apps.
- New shared style tokens/partials are needed.
- Global Ionic-safe style overrides are needed for multiple apps.

## Do Not

- Add app-only business logic.
- Add settings persistence/file/ads logic.
- Duplicate reusable UI inside individual apps.

## API Surface (Real Exports)

- `src/index.ts`
- `src/lib/components/index.ts`
- `src/lib/components/scrollable-button-bar/scrollable-button-bar.component.ts`
- `src/lib/components/editor-panel/editor-panel.component.ts`
- `src/lib/components/save-cover-modal/save-cover-modal.component.ts`
- `src/lib/edge-to-edge/edge-to-edge.service.ts`
- SCSS entrypoints in `styles/` (for example `styles/index.scss`, `styles/components.scss`, `styles/toast.scss`)

## App Consumption Pattern

- TypeScript imports from `@sheldrapps/ui-theme`.
- SCSS imports from `@sheldrapps/ui-theme/styles/*` in app `global.scss` and `theme/variables.scss`.
- Real usage examples:
  - `apps/cover-creator-for-kindle/src/global.scss`
  - `apps/epub-cover-changer/src/global.scss`
  - `apps/presupuesto-ninos/src/global.scss`

## Test Guidance

- This package currently has no standalone test script in `package.json`.
- Validate integration via app tests and guardrails:
  - `pnpm test`
  - `pnpm lint`
