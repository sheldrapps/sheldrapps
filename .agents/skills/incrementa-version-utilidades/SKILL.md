---
name: incrementa-version-utilidades
user-invocable: true
description: "Incrementa version de app movil y actualiza build.gradle + version-notes.xml. Use when user says 'Incrementa la versión de <short_name>' where <short_name> is the initials alias of the app name, or an equivalent versioning request."
---

# Incrementa Version Utilidades

## Trigger

- `Incrementa la versión de <short_name>`
- `incrementa la version de <short_name>`
- `sube version <short_name>`
- `actualiza version <short_name>`
- `actualiza solo version notes para <short_name>`
- `genera solo version notes para <short_name>`

`<short_name>` siempre es el alias corto formado por la primera letra de cada palabra del nombre de la app.

Ejemplos:

- `EPUB FIXER` -> `ef`
- `Cover Creator for Kindle` -> `ccfk`
- `Presupuesto Niños` -> `pn`

Alias soportados:

- `ccfk` -> `cover-creator-for-kindle`
- `ecc` -> `epub-cover-changer`
- `jos` -> `just-one-step`
- `ef` -> `epub-fixer`
- `pn` -> `presupuesto-ninos`

## Source of truth

- Version source only: `apps/<project>/android/app/build.gradle`
- Release copy only: `docs/utilities/<short-name>/version-notes.xml`
- Delta is derived each run from the current working tree vs last published version; do not treat it as immutable.
- Scope de evidencia: `apps/<project>/**` + `packages/**`
- Cuando haya cambios en archivos compartidos, revisar si el proyecto los consume directa o indirectamente y reflejar el impacto visible en la app.
- El orden correcto siempre es: primero `build.gradle`, luego `version-notes.xml`.
- Nunca usar archivos de `docs/utilities/<short-name>` para decidir el `versionCode` real.

## Skill-first contract

La skill hace la inteligencia:

1. Decide `versionName` descriptivo (<= 30 chars) con base en delta user-facing.
2. Redacta `version-notes.xml` por locale con contenido real (no placeholder si hay cambios visibles).
3. Si hay cambios en elementos compartidos que la app usa, conviértelos en beneficios observables para esa app y redacta las notas como experiencia de usuario, no como detalle interno.
4. Redacta siempre las notas desde el delta actual. No copies ni arrastres texto de notas anteriores salvo que siga siendo estrictamente cierto para el cambio nuevo.
5. Verifica que `build.gradle` y `version-notes.xml` coinciden en el `currentVersionCode` final y en el siguiente valor esperado.
6. Si materializas evidencia intermedia, `delta.json` es temporal y no se conserva como artefacto de release.

## Required outputs

Siempre actualizar:

1. `apps/<project>/android/app/build.gradle`
2. `docs/utilities/<short-name>/version-notes.xml`

### Modo `solo version-notes`

Si el usuario pide explicitamente ejecutar solo version notes:

- Actualizar unicamente `docs/utilities/<short-name>/version-notes.xml`.
- No modificar `versionCode`/`versionName` en `build.gradle`.
- Basar el texto en cambios user-facing reales del delta actual.

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

- Escribir siempre `version-notes.xml` en `UTF-8`.
- No dejar mojibake ni reemplazos de caracteres.
- Bloquear salida si aparece cualquiera de estos patrones:
  - `\\u00C3|\\u00C2|\\uFFFD`
  - `\?{2,}`
  - `[A-Za-z]\?[A-Za-z]`
- Si el entorno rompe scripts no latinos, usa el script nativo correcto del idioma o apóyate en las traducciones existentes de la app. Nunca transliteres idiomas no latinos a ASCII dentro de `version-notes.xml`.
- Para `ar`, `ru-RU`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `hi-IN` y cualquier otro locale no latino, escribe siempre en su escritura local.
- Si no puedes garantizar la escritura correcta de un locale no latino, detén la generación y revisa las traducciones fuente antes de cerrar.
- Nunca cerrar la tarea con `?` dentro de palabras en `version-notes.xml`.

## Validation before close

- `versionCode` incrementado cuando el usuario lo pide.
- `versionCode` incrementado en `build.gradle` antes de cerrar.
- `versionName` <= 30 y descriptivo.
- El delta se recalcula desde el working tree actual, no desde una captura inmutable.
- `version-notes.xml` en los 13 locales obligatorios y sin placeholders si hay cambios visibles.
- `version-notes.xml` sin mojibake ni artifacts `?`.
- Si los cambios vienen de piezas compartidas, las notas deben describir el resultado que ve el usuario en la app, evitando mencionar infraestructura, kits, paquetes o términos técnicos.
- Las notas no deben repetir literalmente el release anterior. Deben resumir el cambio actual, aunque el alcance sea pequeño.
