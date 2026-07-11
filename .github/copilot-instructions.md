# Copilot Instructions (Skill Binding)

Skills are source of truth.

## Router

- Trigger: version bump / release notes / `incrementa la version para <proyecto>` / `sube version` / `actualiza version` -> `.agents/skills/incrementa-version-utilidades/SKILL.md`
- Trigger: Play Store fichas / ASO / listing copy / `genera fichas` / `ficha play store` -> `.agents/skills/fichas/SKILL.md`
- Trigger: create or scaffold Ionic app / new app / `crear app` / `scaffold app` -> `.agents/skills/create-ionic-app/SKILL.md`
- Trigger: reusable UI / component UI / redesign component / `agrega componente UI` -> `.agents/skills/add-ui-component/SKILL.md`
- Trigger: TypeScript implementation or refactor / Angular feature work / `TS implementation/refactor` -> `.agents/skills/programar-ts/SKILL.md`
- Trigger: validation / lint test build / completed change check / `validate completed change` -> `.agents/skills/validacion/SKILL.md`
- Trigger: handoff / next session summary / continuation brief -> `.agents/skills/handoff/SKILL.md`
- Trigger: create or update a skill / skill authoring / `write a skill` -> `.agents/skills/write-a-skill/SKILL.md`
- Trigger: motion review / animation polish / `grill me` / `grill-me` / `/grill-me` -> `.agents/skills/grill-me/SKILL.md`
- Trigger: terse mode / brief reply / `caveman mode` / `use caveman` / `/caveman` -> `.agents/skills/caveman/SKILL.md`

Skills are selected by semantic match, not only exact text. If a request clearly fits a skill's scope, load that skill even when the user wording differs from the examples above. If multiple skills apply, load all relevant ones.

## Always-On Skills Policy

- In this repository, load and apply `.agents/skills/grill-me/SKILL.md` for every user request, even when no trigger phrase is present.
- In this repository, load and apply `.agents/skills/caveman/SKILL.md` for every assistant response, even when no trigger phrase is present.

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
