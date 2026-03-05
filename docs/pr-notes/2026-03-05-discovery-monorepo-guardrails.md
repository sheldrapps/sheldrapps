# Discovery Note - Monorepo Guardrails (2026-03-05)

- Package manager: `pnpm@10.28.2`.
- Workspace layout: `apps/*`, `packages/*`.
- Current apps:
  - `apps/cover-creator-for-kindle`
  - `apps/epub-cover-changer`
  - `apps/presupuesto-ninos`
- Settings kit source:
  - `packages/settings-kit/src/lib/settings-store/settings.store.ts`
  - `packages/settings-kit/src/lib/storage/config-json-file.adapter.ts`
- `config.json` persistence is wired in:
  - `apps/cover-creator-for-kindle/src/main.ts`
  - `apps/epub-cover-changer/src/main.ts`
- `apps/presupuesto-ninos/src/main.ts` still uses default settings adapter (no `ConfigJsonFileAdapter`).
