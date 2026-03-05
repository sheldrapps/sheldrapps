# Sheldrapps Monorepo Agent Rules

This repository is a pnpm workspace for Ionic + Angular apps and shared kits.  
Apps live in `apps/*`; reusable kits live in `packages/*`.  
Current production-facing apps are `cover-creator-for-kindle`, `epub-cover-changer`, and `presupuesto-ninos`.  
Cross-app logic is expected to be implemented in kits first and consumed from apps through workspace imports.

## Golden Commands

- Install: `pnpm i`
- Test guardrails/settings contracts: `pnpm test`
- Lint all workspaces: `pnpm lint`
- Build all workspaces with a `build` script: `pnpm build`
- Run one app locally: `pnpm --filter <app-name> start`

## Kits-First Rule (Primordial)

Before adding code in any app, check kits first.

- Reusable UI components or style tokens: use `packages/ui-theme`.
- Settings and persistence: use `packages/settings-kit`.
- File access/share: use `packages/file-kit`.
- Ads/consent logic: use `packages/ads-kit`.
- Image validation/pipeline/editor flow: use `packages/image-workflow`.
- Recommended apps discovery/landing: use `packages/recommended-apps`.

When in doubt, default to kits and only keep app-specific wiring in `apps/*`.

## SCSS Rule

- Do not add new SCSS files in apps by default.
- New shared styles/tokens go to `packages/ui-theme`.
- App SCSS is allowed only for justified overrides tied to that app.
- Guardrail test enforces this with an allowlist from current repo state.

## New App Rule

Standard new app baseline:

- Ionic Angular app inside this monorepo (`apps/<new-app>`).
- Tabs navigation pattern.
- Tab #3 must be Settings when the app has at least 3 tabs.
- Settings should consume `@sheldrapps/settings-kit`.
- Persistent settings should use `config.json` where implemented today:
  - Current reference wiring: `ConfigJsonFileAdapter` in
    `apps/cover-creator-for-kindle/src/main.ts` and
    `apps/epub-cover-changer/src/main.ts`.
  - `presupuesto-ninos` still uses default adapter path (no `ConfigJsonFileAdapter` yet).

## Definition Of Done

- `pnpm test` passes.
- `pnpm lint` passes.
- `pnpm build` passes.

## Unclear Ownership

If you are unsure where code belongs, place reusable behavior in a kit first and wire it from the app.
