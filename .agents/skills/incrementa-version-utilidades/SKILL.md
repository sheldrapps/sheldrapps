---
name: incrementa-version-utilidades
user-invocable: true
description: "Bumps a mobile app version and updates `build.gradle` plus release notes from the current delta. Use when the user asks to increase version, update release notes, publish a mobile release, or says 'sube version'."
---

# Incrementa versión de utilidades

## Alcance

Actualiza únicamente:

1. `apps/<project>/android/app/build.gradle`
2. `docs/utilities/<short-name>/version-notes.xml`

No crear, leer ni actualizar `utility.md`, `state.json`, `delta.json` u otro artefacto de fichas. La gestión de fichas no forma parte de esta skill.

## Apps

| Alias | Proyecto |
| --- | --- |
| `eme` | `epub-metadata-editor` |
| `ef` | `epub-fixer` |
| `ecc` | `epub-cover-changer` |
| `pcm` | `pdf-cover-maker` |
| `ccfk` | `cover-creator-for-kindle` |
| `emas` | `epub-merger-and-splitter` |
| `pmas` | `pdf-merger-and-splitter` |

`active` resuelve el grupo definido en `scripts/app-shortcuts.cjs`; no copies esa lista aquí.

## Flujo

1. Lee `versionCode` y `versionName` desde `build.gradle`; es la única fuente de versión.
2. Calcula el delta actual de `apps/<project>/**` y `packages/**` desde la versión publicada.
3. Incrementa `versionCode` y asigna un `versionName` descriptivo de hasta 30 caracteres.
4. Sobrescribe `version-notes.xml` con notas reales del delta, centradas en lo que ve la persona usuaria.
5. Mantén el `versionCode` de las notas alineado con el valor final de `build.gradle`.

### Solo notas

Si el usuario pide solo release notes, actualiza únicamente `version-notes.xml` y conserva la versión de `build.gradle`.

## Release notes

Incluye siempre `en-US`, `ar`, `de-DE`, `es-419`, `fr-FR`, `hi-IN`, `it-IT`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `zh-CN` y `zh-TW`.

- Escribe UTF-8 y conserva la escritura propia de cada idioma.
- No uses placeholders, mojibake ni texto de infraestructura.
- Resume el delta actual; no arrastres notas de una versión anterior.

## Validación

- `versionCode` aumentó cuando se solicitó incremento.
- `versionName` es descriptivo y tiene hasta 30 caracteres.
- `version-notes.xml` incluye los 13 locales y coincide con el cambio actual.
- No se modificaron `utility.md`, `state.json`, `delta.json` ni artefactos de fichas.
