# Copilot Instructions (Skill Binding)

Skills are source of truth.

## Router

- Trigger: `incrementa la version para <proyecto>` -> `.agents/skills/incrementa-version-utilidades/SKILL.md`
- Trigger: `genera fichas` / `ficha play store` / `ASO` -> `.agents/skills/fichas/SKILL.md`
- Trigger: `crear app` / `scaffold app` -> `.agents/skills/create-ionic-app/SKILL.md`
- Trigger: `agrega componente UI` -> `.agents/skills/add-ui-component/SKILL.md`
- Trigger: TS implementation/refactor -> `.agents/skills/programar-ts/SKILL.md`
- Trigger: validate completed change -> `.agents/skills/validacion/SKILL.md`

## Increment Version Contract

- Version source only: `apps/<app>/android/app/build.gradle`
- Evidence scope: `apps/<app>/**` + `packages/**`
- Skill-first: model decides `versionName`, `utility.md`, `version-notes.xml` wording from real delta evidence.
- Script is optional evidence helper only:
  - `pnpm increment:collect <proyecto|alias> [--delta-from-anchor]`

## Required outputs

- `docs/utilities/<short-name>/utility.md`
- `docs/utilities/<short-name>/state.json`
- `docs/utilities/<short-name>/version-notes.xml` (overwrite each run)
