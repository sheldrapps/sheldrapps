---
name: add-ui-component
description: Add or update a reusable UI component following this monorepo standard: search ui-theme first, implement component in @sheldrapps/ui-theme when reusable, export it, then consume from app without creating new app-level SCSS unless justified.
---

# Add Reusable UI Component

## Checklist

1. Search existing ui-theme assets before creating anything:
   - `packages/ui-theme/src/lib/components`
   - `packages/ui-theme/styles`
2. Reuse existing tokens/styles if possible.
3. If missing, create component in `packages/ui-theme/src/lib/components/<component-name>/`:
   - `<component-name>.component.ts`
   - optional `.html`
   - optional `.scss` (inside ui-theme, not app)
4. Export component from:
   - `packages/ui-theme/src/lib/components/index.ts`
   - ensure `packages/ui-theme/src/index.ts` still exports components.
5. If new shared style partial is needed, add it to `packages/ui-theme/styles/` and expose in `styles/index.scss`.
6. Consume in app by importing from `@sheldrapps/ui-theme`.
7. Avoid new app SCSS files. If override is unavoidable, document why in the app change and keep scope local.

## Consumption Examples

- TS component/service import:
  - `import { SaveCoverModalComponent } from '@sheldrapps/ui-theme';`
  - real usage: `apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts`
- SCSS import:
  - `@use '@sheldrapps/ui-theme/styles/components' as *;`
  - real usage: `apps/epub-cover-changer/src/app/pages/change/change.page.scss`

## Validation Steps

1. `pnpm test` (guardrails catch new app SCSS outside allowlist)
2. `pnpm lint`
3. `pnpm build`
4. App-specific check:
   - `pnpm --filter <app-name> start`
   - `pnpm --filter <app-name> build`
