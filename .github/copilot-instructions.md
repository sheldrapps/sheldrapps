# Copilot Instructions (Skill Binding)

Skills are source of truth. This file binds triggers to skill files and defines allowed runtime contract.

## Router

- Trigger: "incrementa la versión para <proyecto>", "incrementar versión <proyecto>", "sube versión <proyecto>"
  - Skill: `.agents/skills/incrementa-version-utilidades/SKILL.md`
- Trigger: "genera fichas", "ficha play store", "ASO"
  - Skill: `.agents/skills/fichas/SKILL.md`
- Trigger: "crear app", "scaffold app", "nueva app"
  - Skill: `.agents/skills/create-ionic-app/SKILL.md`
- Trigger: "agrega componente UI", "hazlo como en...", "reusar componente"
  - Skill: `.agents/skills/add-ui-component/SKILL.md`
- Trigger: implementación/refactor TypeScript
  - Skill: `.agents/skills/programar-ts/SKILL.md`
- Trigger: validar cambio terminado
  - Skill: `.agents/skills/validacion/SKILL.md`

## Allowed Contract: Increment Version Flow

### Allowed sources

- `apps/<app>/android/app/build.gradle` for `versionCode`/`versionName`
- product delta evidence from:
  - `apps/<app>/**`
  - `packages/**` used by app

### Allowed default behavior

- If no target version specified: `newVersionCode = currentVersionCode + 1`
- If no explicit `--version-name`, generate concise `versionName` (<= 30 chars) from delta; fallback `Release <code>`

### Required execution path

- Prefer skill-first execution for incremental version updates.
- Use scripts only as optional evidence helpers, not as the source of final wording quality.
- `versionName` must be descriptive from real delta evidence, never generic placeholders.
- Optional helper:
  - `pnpm increment:version <proyecto|alias> --collect-only`

### Required outputs

- `docs/utilities/<short-name>/utility.md`
- `docs/utilities/<short-name>/state.json`
- `docs/utilities/<short-name>/version-notes.xml` (overwrite each run, no per-version history)

### Allowed version-notes format (exact)

```xml
<en-US>
...
</en-US>

<de-DE>
...
</de-DE>

<es-419>
...
</es-419>

<fr-FR>
...
</fr-FR>

<it-IT>
...
</it-IT>

<pt-BR>
...
</pt-BR>
```

Notes policy:
- Prefer real user-facing notes from app/package diff.
- Use placeholders only when no visible user-facing changes exist.

## Execution mode

- Complete end-to-end implementation, not diagnosis-only.
- If regression detected, ask user behavior decision.
- If non-regression error, fix directly.
