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

## Reuse Promotion Rule (Critical)

- Any element with cross-app reuse potential must be promoted to a shared implementation.
- If the user says "hazlo como en..." (or equivalent), treat that as an explicit signal to extract and reuse.
- If a pattern appears in more than one app, do not duplicate it again in `apps/*`.
- Reusable UI must be extracted to `packages/ui-theme` (component, utility, token, or shared style).
- Reusable non-visual behavior must be extracted to the corresponding kit under `packages/*`.
- App code should only keep thin integration and host-specific wiring.
- If extraction is blocked by scope, stop and report the blocker instead of shipping a new duplicated implementation.

## Architecture And Code Quality Rule (Critical)

- New and modified code must follow SOLID principles.
- Apply Clean Code defaults: small focused functions, intention-revealing naming, and low cyclomatic/cognitive complexity.
- Avoid god functions and deep branching; prefer composition and explicit collaborators.
- Respect Clean Architecture boundaries:
  - domain logic isolated from framework/IO details,
  - app layers depend inward on abstractions,
  - adapters/infrastructure stay at the edges.
- Prefer dependency inversion for external services and platform APIs.
- Any touched "complex" function should be simplified in the same change when feasible (extract methods, split responsibilities, reduce nesting).
- If simplification cannot be completed safely in scope, add a short TODO with reason and propose the next extraction step in the final report.

## SCSS Rule

- Do not add new SCSS files in apps by default.
- New shared styles/tokens go to `packages/ui-theme`.
- App SCSS is allowed only for justified overrides tied to that app.
- Guardrail test enforces this with an allowlist from current repo state.

## Component Structure Rule (Critical)

- For Angular UI modules, use `components` folders; do not create new `views` folders.
- Do not keep component templates/styles inline in `.ts` files.
- Components must use `templateUrl` and `styleUrls` with dedicated `.html` and `.scss` files.
- Inline templates/styles are only acceptable for explicit user-requested exceptions.

## UI Theme First Visual Rule

- Always implement visual language in `packages/ui-theme` first (tokens, shared components, utilities).
- In `apps/*`, use only lightweight local overrides for host-specific differences.
- Do not introduce hardcoded visual values in page SCSS (`font-size`, `opacity`, spacing, interactive sizes) when an equivalent ui-theme token exists.
- If a hardcoded value is truly necessary, keep it local and add a short comment explaining why it cannot be tokenized yet.

## Layout Alignment Rule (Critical)

- For pages that mix action buttons and inset cards/lists, horizontal alignment must be identical.
- Use this exact wrapper for top/bottom full-width action buttons:
  - container style: `padding: 0 var(--app-space-7)` (and optional bottom spacing with `var(--app-space-8)`).
  - button: `class="app-btn" expand="block"`.
- For JOS-style card layouts, prefer tokenized surfaces from `ui-theme` such as `app-accent-surface` + `app-accent-card-body` or `app-secondary-surface`.
- For workflow/status screens that follow the JOS card pattern, do not use `ion-list` as a generic card container.
- Use `ion-list inset="true"` only for genuine list content sections that are semantically lists.
- When a page defines local spacing, expose local CSS custom properties that point to `--app-space-*` tokens for both horizontal and vertical rhythm instead of scattering raw token references throughout the file.
- Inside inset cards/lists, keep content padding as `var(--app-space-8) var(--app-space-7)` unless the user explicitly requests a different value.
- Before finishing, visually verify (or compare computed layout structure in template) that:
  - action button left/right edges match card/list content edges,
  - no section uses extra horizontal padding that makes width drift by a few pixels.

## New App Rule

Standard new app baseline:

- Ionic Angular app inside this monorepo (`apps/<new-app>`).
- Tabs navigation pattern.
- Settings must always be the last tab in apps that use tabs navigation.
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

## Execution Protocol (Anti-Loop)

### Scope Lock (Mandatory before edits)

- Define target scope before coding: affected app/kit, acceptance criteria, and explicit non-goals.
- Keep plan short (max 3 steps) and execute smallest-diff-first.
- Avoid opportunistic refactors outside scope unless required for correctness.

### Requirement Clarification Gate (Mandatory)

- If the request is vague, ambiguous, or underspecified, do not make behavioral decisions implicitly.
- Ask concise blocking questions until scope, acceptance criteria, constraints, and expected output are explicit.
- Do not start implementation until those answers are available, except for clearly reversible preparation work.
- Before coding, restate the agreed requirement in a short checklist and use it as the implementation contract.

### Retry Cap (Hard Stop)

- If the same error or failure repeats 2 times, stop blind retries.
- Report root cause hypothesis and provide exactly 2 concrete options with tradeoffs.
- Do not keep rerunning expensive/global commands without a material code or config change.

### Validation Ladder (Time/Token Efficiency)

- Validate local/focused scope first (changed file/module/app).
- Run global workspace validations (`pnpm lint`, `pnpm test`, `pnpm build`) once near the end, when required by Definition Of Done.
- Do not run full-monorepo validations early when the change is still unstable.

### Escalation Gate

- If a decision has non-obvious behavioral impact, ask one concise blocking question before proceeding.
- If impact is low, choose the minimal safe assumption and continue.

### Risk And Failure Disclosure (Mandatory)

- For non-trivial changes, explicitly report key risks and likely failure modes before or during implementation.
- Include at least: functional risk, regression risk, performance risk, and integration risk.
- For each identified risk, state mitigation or validation strategy.
- Never close a task without disclosing unresolved risks.

### Proof-Of-Work Output (Mandatory)

- Every completion report must include:
  - files changed,
  - commands run and pass/fail status,
  - pending risks or follow-ups.
- Without this block, the task is not considered complete.

### Teaching Mode In Delivery (Mandatory)

- Delivery is not only execution; it must also teach the reasoning behind the implementation.
- Whenever a change includes RxJS (streams, operators, subscriptions) or any external library, the final report must explain:
  - what each relevant primitive/operator/library is for,
  - why it was chosen over alternatives,
  - subscription lifecycle strategy and leak prevention,
  - expected data flow and error-handling behavior.
- For architecture-relevant changes, explain boundaries, responsibilities, and dependency direction.
- For algorithmic changes, explain the algorithm used, why it fits, and relevant complexity/tradeoffs when applicable.
- Explanations must be concrete and tied to the exact code that was changed, so the report can be used as study material.

### Token Budget Rule

- Prefer targeted reads/searches (`rg`, focused file snippets, diffs) over repeated full-file dumps.
- Do not re-read unchanged files repeatedly.
- Minimize command/output repetition when prior output already answers the question.

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
