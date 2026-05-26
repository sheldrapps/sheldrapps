---
name: fichas
user-invocable: true
description: "Crear/actualizar fichas Play Store SEO/ASO por proyecto+locale, con estrategia regional y límites Play Store. Leer docs/utilities/<short-name>/ sin modificar. Use when user asks 'genera fichas', 'crea ficha Play Store', or localized listing copy/visual direction for ecc/ccfk/other locales."
---

# Fichas Play Store (SEO/ASO)

## Activación de la skill

Activa esta skill cuando la intención del usuario sea generar, actualizar o revisar fichas de Play Store, por ejemplo:

- `genera las fichas para ecc`
- `crea fichas para ccfk en es-MX, en-US`
- `actualiza la ficha de epub-fixer para fr-FR`
- `haz fichas para otro proyecto`

Si el usuario pide `otro proyecto`, resuelve el proyecto desde `apps/*` y sus aliases.

## Objetivo

Generar documentos markdown de fichas con:

- estrategia de nombre por locale,
- short description,
- long description,
- estrategia de conversión regional,
- dirección visual para feature graphic y 5 screenshots,
- sistema de color,
- notas y supuestos.

La ficha debe ser localizada por mercado. Traducir literalmente una sola versión para todos los locales es incorrecto.

No generar imágenes. No usar herramientas de image generation. Solo crear/editar markdown.

## Contrato de entrada

La entrada puede incluir:

- 1 proyecto o varios,
- 1 locale o varios,
- pedido de crear o actualizar.

Si faltan locales:

- cuando el usuario diga `todos`, tomar los locales soportados por el proyecto en `apps/<project>/src/assets/i18n/**/*.json`,
- cuando no especifique, usar `es-MX` como default y explicarlo en `Notes / Assumptions`.

## Resolución de proyecto y aliases

Resolver primero por aliases comunes:

- `ccfk` -> `cover-creator-for-kindle`
- `ecc` -> `epub-cover-changer`
- `ef` -> `epub-fixer`
- `jos` -> `just-one-step`
- `pn` -> `presupuesto-ninos`

Si no hay match por alias, buscar coincidencia directa en `apps/<name>`.

Si sigue ambiguo, pedir una sola aclaración corta.

## Locales soportados actualmente (detectados en repo)

- `cover-creator-for-kindle`: `ar-SA`, `de-DE`, `en-US`, `es-MX`, `fr-FR`, `hi-IN`, `it-IT`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `zh-CN`, `zh-TW`
- `epub-cover-changer`: `ar-SA`, `de-DE`, `en-US`, `es-MX`, `fr-FR`, `hi-IN`, `it-IT`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `zh-CN`, `zh-TW`
- `epub-fixer`: `de-DE`, `en-US`, `es-MX`, `fr-FR`, `it-IT`, `pt-BR`
- `just-one-step`: `de-DE`, `en-US`, `es-MX`, `fr-FR`, `it-IT`, `pt-BR`
- `presupuesto-ninos`: `de-DE`, `en-US`, `es-MX`, `fr-FR`, `it-IT`, `pt-BR`

Si se agregan nuevos locales en el repo, priorizar descubrimiento dinámico sobre esta lista estática.

## Fuentes a leer (obligatorias)

Antes de redactar cada ficha, revisar:

- `apps/<project>/**`
- `apps/<project>/src/assets/i18n/**/*.json`
- `apps/<project>/src/main/res/values*/strings.xml`
- `docs/utilities/<short-name>/**` (solo lectura, no modificar)
- `packages/**` (para capacidades reales compartidas)
- `README.md` y `docs/**` relevantes

`docs/utilities/<short-name>/` puede estar vacío por ahora. Si no hay contenido utilizable, continuar con análisis de código y dejar constancia en `Notes / Assumptions`.

## Ubicación de salida

Crear 1 archivo por proyecto/locale en:

`docs/fichas/<project-id>/<locale>.md`

No sobrescribir una ficha existente salvo solicitud explícita de regeneración/actualización.
Si ya existe y no se pidió reemplazo, crear:

`docs/fichas/<project-id>/<locale>.draft.md`

Si se generan varias fichas, crear o actualizar:

`docs/fichas/README.md`

## Reglas de Play Store (obligatorias)

- App name: máximo 30 caracteres.
- Short description: máximo 80 caracteres.
- Long description: máximo 4000 caracteres.

Siempre incluir conteo de caracteres en la ficha.

No prometer features no implementadas.
Solo mencionar privacidad, offline, cuenta, compatibilidad y formatos si se confirma en código/configuración.

## Regla de nombre de app

Por locale, buscar primero el nombre actual en:

- `strings.xml` -> `app.title`
- claves equivalentes en i18n del proyecto

Si existe nombre local:

- reportarlo como nombre actual,
- contar caracteres,
- proponer alternativa solo si falla por SEO/claridad/límite.

Si no existe:

- proponer nombre localizado,
- evitar traducción literal pobre,
- mantener <= 30 caracteres.

## Estructura markdown requerida

Cada ficha debe seguir exactamente esta estructura:

```md
# <App Name> - <locale> Play Store Listing

## Purpose

## App Name
Current localized name from strings.xml/app.title:
Suggested localized name, if needed:
Character count:
Reasoning:

## Short Description
Text:
Character count:
Reasoning:

## Long Description
Text:
Character count:
SEO/ASO notes:

## Regional Conversion Strategy
Primary user desire:
Best use cases to show:
What to avoid:
Search/ASO terms to include naturally:

## Visual System
Palette:
- primary background:
- secondary background:
- accent:
- optional warm/cool accent:
- headline color:
- subline color:
General visual rules:

## Feature Graphic
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
bullets:
conversion intent:

## Screenshot 1
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
conversion intent:

## Screenshot 2
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
conversion intent:

## Screenshot 3
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
conversion intent:

## Screenshot 4
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
conversion intent:

## Screenshot 5
titulo:
subline:
headline color:
subline color:
wrapper:
fondo:
imagen:
conversion intent:

## Notes / Assumptions
- ...
```

No agregar secciones top-level extra salvo necesidad justificada.

## Campos visuales y wrappers permitidos

Wrappers base:

- `kindle/e-reader emulado`
- `teléfono emulado`
- `captura directa de app`
- `composición gráfica con dispositivo + bullets`

Para apps no e-reader, adaptar contexto sin cambiar nombres de campos.

Tamaños por defecto (si el usuario no da otros):

- fondo vertical: `1994x3456 px`
- screenshot teléfono: `972x2106 px`
- imagen en e-reader emulado: `1313x1751 px`
- gráfico horizontal tipo feature: `1024x500 px`

Incluir estos tamaños explícitamente dentro de `fondo:` e `imagen:`.

## Localización real por idioma

No reutilizar concepto idéntico entre locales cambiando solo texto.
Cada locale debe cambiar:

- intención principal,
- léxico de búsqueda,
- tono,
- dirección visual.

Aplica esta regla también para locales frecuentemente olvidados:

- `ar-SA`
- `hi-IN`
- `ja-JP`
- `ko-KR`
- `ru-RU`
- `zh-CN`
- `zh-TW`

## Uso seguro de marcas

Se permite uso descriptivo si es verídico:

- `Compatible with Kindle, Kobo and other e-readers`

Se prohíbe implicar relación oficial:

- `Official Kindle app`
- `Kindle-approved`
- `Amazon Kindle Cover Creator`

## Checklist de validación final

- ruta correcta: `docs/fichas/<project-id>/<locale>.md`
- límites de caracteres cumplidos
- promesas alineadas con implementación real
- diferenciación regional real (no traducción literal)
- 5 screenshots con ángulos distintos
- feature graphic con intención de conversión clara
- sistema visual con contraste seguro para área de copy
- incertidumbres documentadas en `Notes / Assumptions`

## Comportamiento de respuesta

Al terminar, responder con un resumen breve de archivos creados/actualizados.
No pegar el contenido completo de todas las fichas salvo que el usuario lo pida.
