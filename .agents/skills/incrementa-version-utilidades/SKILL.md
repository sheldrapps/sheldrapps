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
- `actualiza solo version notes para <proyecto>`
- `genera solo version notes para <proyecto>`

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
3. Construye `utility.md` como registro factual para trazabilidad de release/versionado (no como input para `fichas`).
4. Actualiza `state.json` para incremental siguiente.

Script opcional de evidencia:

- `pnpm increment:collect <proyecto|alias> [--delta-from-anchor]`
- Genera `docs/utilities/<short-name>/delta.json` y no decide wording final.

## Required outputs

Siempre actualizar:

1. `docs/utilities/<short-name>/utility.md`
2. `docs/utilities/<short-name>/state.json`
3. `docs/utilities/<short-name>/version-notes.xml`

### Modo `solo version-notes`

Si el usuario pide explicitamente ejecutar solo version notes:

- Actualizar unicamente `docs/utilities/<short-name>/version-notes.xml`.
- No modificar `versionCode`/`versionName` en `build.gradle`.
- No modificar `docs/utilities/<short-name>/utility.md`.
- No modificar `docs/utilities/<short-name>/state.json`.
- Basar el texto en cambios user-facing reales del delta actual.

## Utility format goal

`utility.md` debe contener hechos estructurados para trazabilidad técnica de release:

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
- `ar`
- `de-DE`
- `es-419`
- `fr-FR`
- `hi-IN`
- `it-IT`
- `ja-JP`
- `ko-KR`
- `pt-BR`
- `ru-RU`
- `zh-CN`
- `zh-TW`

Formato:

```xml
<en-US>
...
</en-US>

<ar>
...
</ar>

<de-DE>
...
</de-DE>

<es-419>
...
</es-419>

<fr-FR>
...
</fr-FR>

<hi-IN>
...
</hi-IN>

<it-IT>
...
</it-IT>

<ja-JP>
...
</ja-JP>

<ko-KR>
...
</ko-KR>

<pt-BR>
...
</pt-BR>

<ru-RU>
...
</ru-RU>

<zh-CN>
...
</zh-CN>

<zh-TW>
...
</zh-TW>
```

## Encoding y anti-artifacts (obligatorio)

- Escribir siempre `version-notes.xml`, `utility.md` y `state.json` en `UTF-8`.
- No dejar mojibake ni reemplazos de caracteres.
- Bloquear salida si aparece cualquiera de estos patrones:
  - `\\u00C3|\\u00C2|\\uFFFD`
  - `\?{2,}`
  - `[A-Za-z]\?[A-Za-z]`
- Si el entorno rompe scripts no latinos, usar transliteracion legible sin artifacts en vez de texto corrupto.
- Nunca cerrar la tarea con `?` dentro de palabras en `version-notes.xml`.

## Validation before close

- `versionCode` incrementado cuando el usuario lo pide.
- `versionName` <= 30 y descriptivo.
- `utility.md` factual y util para trazabilidad/versionado.
- `version-notes.xml` en los 13 locales obligatorios y sin placeholders si hay cambios visibles.
- `version-notes.xml`, `utility.md` y `state.json` sin mojibake ni artifacts `?`.
