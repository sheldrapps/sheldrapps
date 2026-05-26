---
name: incrementa-version-utilidades
user-invocable: true
description: "Incrementa version de app movil y genera utilidades/notes con inteligencia basada en cambios reales. Use when user says 'incrementa la version para <proyecto>' o equivalente."
---

# Incrementa Version Utilidades

## Trigger

- `incrementa la version para <proyecto>`
- `sube version <proyecto>`
- `actualiza version <proyecto>`

Alias soportados:

- `ccfk` -> `cover-creator-for-kindle`
- `ecc` -> `epub-cover-changer`
- `jos` -> `just-one-step`
- `ef` -> `epub-fixer`
- `pn` -> `presupuesto-ninos`

## Source of truth

- Version source only: `apps/<project>/android/app/build.gradle`
- Scope de evidencia: `apps/<project>/**` + `packages/**`

## Skill-first contract

La skill hace la inteligencia:

1. Decide `versionName` descriptivo (<= 30 chars) con base en delta user-facing.
2. Redacta `version-notes.xml` por locale con contenido real (no placeholder si hay cambios visibles).
3. Construye `utility.md` como input factual para la skill `fichas` (no como ficha final).
4. Actualiza `state.json` para incremental siguiente.

Script opcional de evidencia:

- `pnpm increment:collect <proyecto|alias> [--delta-from-anchor]`
- Genera `docs/utilities/<short-name>/delta.json` y no decide wording final.

## Required outputs

Siempre actualizar:

1. `docs/utilities/<short-name>/utility.md`
2. `docs/utilities/<short-name>/state.json`
3. `docs/utilities/<short-name>/version-notes.xml`

## Utility format goal

`utility.md` debe contener hechos estructurados para `fichas`:

- identidad/versiones
- capacidades verificadas + evidencia
- diferenciadores
- casos de uso validos
- facts user-facing del incremento
- coverage de locales
- constraints/no-goals

## Version-notes format

Archivo: `docs/utilities/<short-name>/version-notes.xml` (overwrite each run).

Locales obligatorios:

- `en-US`
- `de-DE`
- `es-419`
- `fr-FR`
- `it-IT`
- `pt-BR`

Formato:

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

## Validation before close

- `versionCode` incrementado cuando el usuario lo pide.
- `versionName` <= 30 y descriptivo.
- `utility.md` factual y util para `fichas`.
- `version-notes.xml` sin placeholders si hay cambios visibles.
- no mojibake.
