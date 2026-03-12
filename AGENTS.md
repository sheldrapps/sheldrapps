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

## UI Theme First Visual Rule

- Always implement visual language in `packages/ui-theme` first (tokens, shared components, utilities).
- In `apps/*`, use only lightweight local overrides for host-specific differences.
- Do not introduce hardcoded visual values in page SCSS (`font-size`, `opacity`, spacing, interactive sizes) when an equivalent ui-theme token exists.
- If a hardcoded value is truly necessary, keep it local and add a short comment explaining why it cannot be tokenized yet.

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

## Android Device Install Rule

- When installing an updated app on a phone, always run this full sequence:
  1. `pnpm --filter <app-name> build`
  2. `npx cap sync android` (from `apps/<app-name>`)
  3. `.\gradlew.bat clean :app:assembleDebug` (from `apps/<app-name>/android`)
  4. `adb -s <device-id> install -r "<absolute-path-to-app-debug.apk>"`
- Do not skip steps.
- Run all steps sequentially (never in parallel).

## Text And i18n Rule

- Any requested text change must be implemented via i18n keys, never hardcoded UI text.
- Update translations in all supported app locales in the same change.
- For CCFK and ECC, this means updating every file under each app `src/assets/i18n/` locale set.

### Encoding And Diacritics Safety (Critical)

- Never remove diacritics or locale-specific characters from translations (`á`, `é`, `í`, `ó`, `ú`, `ü`, `ñ`, `ç`, `ã`, `õ`, `ê`, etc.).
- Never use `?` as a replacement character inside words in translation values (for example: `descripci?n`, `t?tulo`, `m?chtest`).
- Never serialize translation values using Unicode escape sequences such as `\u00e9`, `\u00f3`, `\u00e7`. Keep readable UTF-8 characters directly in JSON.
- Keep translation JSON files as UTF-8 and valid JSON.
- Prefer targeted edits with `apply_patch`; avoid full-file i18n reserialization unless explicitly requested.
- Do not use shell rewrite flows that may corrupt encoding for i18n JSON (for example redirection from `git show` into files, or `Set-Content` without strict UTF-8 handling).
- If scripting is needed, use Node `fs.readFileSync(..., 'utf8')` and `fs.writeFileSync(..., 'utf8')`.

### Text Generation Fidelity Rule (Critical)

When generating or editing any user-facing text in any supported locale:

- Generate final text with correct native characters from the first edit.
- Do not substitute accented characters or locale punctuation with ASCII approximations.
- Treat any replacement `?` or mojibake (`Ã`, `Â`, `�`) as a hard failure to fix before completion.
- Before applying a patch, re-read every newly added translation value and confirm it uses readable UTF-8 characters.

Examples:
- Correct: `Medir por duración`
- Incorrect: `Medir por duraci?n`
- Incorrect: `Medir por duraci\u00f3n`
- Correct: `¿Qué quieres hacer?`
- Incorrect: `Que quieres hacer?`
- Incorrect: `?Qué quieres hacer?`

If correct characters cannot be produced reliably, stop and report the issue instead of writing degraded text.

### Mandatory i18n checks before completion

After any i18n edit, run checks on `apps/*/src/assets/i18n/*.json`:

1. No replacement-question-mark artifacts inside words: pattern `[A-Za-zÀ-ÿ]\?[A-Za-zÀ-ÿ]`
2. No mojibake artifacts: patterns `Ã|Â|�`
3. No Unicode escape sequences in values: pattern `\\u[0-9a-fA-F]{4}`

If any check fails, fix before reporting completion.

## Unclear Ownership

If you are unsure where code belongs, place reusable behavior in a kit first and wire it from the app.