---
name: incrementa-version-utilidades
description: Ejecuta incremento de versión de app móvil por alias (ccfk/ecc/jos/ef/pn) usando build.gradle como fuente, luego genera/actualiza utilidades incrementales y version-notes en formato Play Store placeholder. Use when user says "incrementa la versión para <proyecto>" o equivalente.
---

# Incrementa Versión De Utilidades

## Entrada válida

- `incrementa la versión para <proyecto>`
- `incrementar versión <proyecto>`
- `sube versión <proyecto>`

`<proyecto>` permitido: `ccfk`, `ecc`, `jos`, `ef`, `pn` o nombre de carpeta en `apps/*`.

## Resolución directa

Aliases:

- `ccfk` -> `cover-creator-for-kindle`
- `ecc` -> `epub-cover-changer`
- `jos` -> `just-one-step`
- `ef` -> `epub-fixer`
- `pn` -> `presupuesto-ninos`

Ruta de versión por app:

- `apps/<project>/android/app/build.gradle`

## Scope permitido

Solo usar como evidencia funcional:

- `apps/<project>/**`
- `packages/**` usados por `<project>`

No hace falta explorar fuera de ese scope para esta tarea.

## Fuente de versión permitida

Usar únicamente en `build.gradle`:

- `versionCode`
- `versionName`

## Regla de incremento

- Si usuario no indica número objetivo: `newVersionCode = currentVersionCode + 1`.
- `versionName` puede mantenerse.
- Si `versionName` cambia, debe ser intencional y <= 30 caracteres.

## Ejecucion skill-first

La skill decide:

1. Evidencia incremental real (git + working tree en scope permitido).
2. `versionName` descriptivo (<= 30 chars) a partir de cambios user-facing.
3. `utility.md` útil para ficha Play Store.
4. `version-notes.xml` por locale con texto real (no placeholders).

Script opcional de apoyo:

- `pnpm increment:version <proyecto|alias> --collect-only`
- Solo para reunir evidencia en `docs/utilities/<short-name>/delta.json`.
- La redacción final de `versionName`, `utility.md` y `version-notes.xml` es responsabilidad de la skill.

## Artefactos obligatorios

Siempre terminar con:

1. `docs/utilities/<short-name>/utility.md`
2. `docs/utilities/<short-name>/state.json`
3. `docs/utilities/<short-name>/version-notes.xml`

Comportamiento:

- Si `utility.md` / `state.json` no existen: crear baseline completo.
- Si existen: refrescar con estado incremental actual.

## Incremental Git permitido

Persistir en `state.json`:

- `project`
- `shortName`
- `baselineCommit`
- `versionCodeAnchorCommit`
- `baseline.versionCode`
- `baseline.versionName`
- `tracking.lastProcessedHead`
- `tracking.lastProcessedAt`
- `tracking.lastWorkingTreeFingerprint`

Regla de delta:

- `versionCodeAnchorCommit` = último commit que tocó el `currentVersionCode` en `build.gradle`.
- Delta = commits desde ancla vigente hasta `HEAD` + `working tree` en scope permitido.

## Version-notes: formato permitido (exacto)

Archivo: `docs/utilities/<short-name>/version-notes.xml` (sobrescribir en cada ejecución, sin historial por versión).

Locales permitidos y obligatorios:

- `en-US`
- `de-DE`
- `es-419`
- `fr-FR`
- `it-IT`
- `pt-BR`

Formato exacto requerido:

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

Regla de contenido:

- No usar placeholders genéricos si hay cambios user-facing en `apps/` o `packages/`.
- Generar texto real a partir de `git diff` (por ejemplo cambios de nombres, textos, features visibles).
- Placeholder solo como fallback cuando no hay cambios visibles para usuarios.

## Validación de cierre

Antes de cerrar, confirmar:

- `versionCode` actualizado en `build.gradle`.
- `versionName` <= 30.
- `utility.md` actualizado.
- `state.json` actualizado con `baselineCommit` + `versionCodeAnchorCommit`.
- `version-notes.xml` existe y fue sobrescrito con formato exacto permitido.

## Respuesta final esperada

Reportar:

- app resuelta (`short-name` y carpeta real),
- `currentVersionCode` -> `newVersionCode`,
- estado de `versionName`,
- rutas de artefactos actualizados,
- riesgos/supuestos abiertos.
