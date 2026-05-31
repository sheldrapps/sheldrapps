---
name: fichas
user-invocable: true
description: "Crear/actualizar fichas Play Store SEO/ASO por proyecto+locale, usando creative brief, strategy matrix/conversion strategy, conversion audit y golden files aprobados como insumos de solo lectura. Use when user asks 'genera fichas', 'crea ficha Play Store', or localized listing copy/visual direction for ecc/ccfk/other locales."
---

# Fichas Play Store (SEO/ASO)

## Activación de la skill

Activa esta skill cuando la intención del usuario sea generar, actualizar o revisar fichas de Play Store, por ejemplo:

- `genera las fichas para ecc`
- `crea fichas para ccfk en es-MX, en-US`
- `actualiza la ficha de epub-fixer para fr-FR`
- `haz fichas para otro proyecto`

Si el usuario pide `otro proyecto`, resuelve el proyecto desde `apps/*` y sus aliases.

## Regla crítica de alcance

Esta skill genera fichas finales de Play Store. No genera estrategia base.

Los documentos estratégicos aprobados son insumos provistos por el usuario y deben tratarse como fuente de verdad de solo lectura:

- `docs/fichas/<project-id>/creative-brief.md`
- `docs/fichas/<project-id>/strategy-matrix.md`
- `docs/fichas/<project-id>/conversion-strategy.md` cuando exista en lugar de `strategy-matrix.md`
- `docs/fichas/<project-id>/conversion-audit.md`
- `docs/fichas/<project-id>/*.golden.md`

La skill debe consumir esos documentos, no producirlos.

No crear, regenerar, corregir, resumir en archivo, actualizar ni modificar:

- `creative-brief.md`
- `strategy-matrix.md`
- `conversion-strategy.md`
- `conversion-audit.md`
- `*.golden.md`

Si alguno de los documentos estratégicos requeridos falta, detener el flujo y reportar exactamente qué archivo falta. No inventar estrategia, no completar huecos con inferencias propias y no sustituir documentos faltantes con análisis del código.

Si el usuario pide explícitamente actualizar `creative-brief.md`, `strategy-matrix.md`, `conversion-strategy.md`, `conversion-audit.md` o `*.golden.md`, esa petición queda fuera del flujo generador de esta skill. Solicitar confirmación explícita para tratarlo como edición manual de documentos estratégicos, no como generación automática de fichas.

## Modo estricto persistente

Esta skill opera en modo estricto y debe mantenerse así sin que el usuario lo repita:

- Solo lectura de archivos de configuración estratégica y audit.
- Solo escritura/creación de fichas finales por locale.
- Cualquier intento de leer fuentes fuera de allowlist o escribir fuera de deliverables permitidos debe abortar.

## Objetivo

Generar documentos markdown finales de fichas con:

- estrategia de nombre por locale,
- short description,
- long description,
- estrategia de conversión regional,
- dirección visual para feature graphic y screenshots,
- sistema de color,
- notas y supuestos.

La ficha debe ser localizada por mercado, pero siempre alineada con los documentos estratégicos aprobados. Traducir literalmente una sola versión para todos los locales es incorrecto.

No generar imágenes. No usar herramientas de image generation. Solo crear/editar markdown de fichas finales.

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

Antes de redactar cada ficha, revisar en este orden:

1. Configuración estratégica en `docs/fichas/<project-id>/`:
   - `creative-brief.md`
   - `strategy-matrix.md` o `conversion-strategy.md`
   - `*.golden.md`
2. Audit en `docs/fichas/<project-id>/`:
   - `conversion-audit.md`
3. Configuración de proyecto para locales y naming:
   - `apps/<project>/src/assets/i18n/**/*.json`
   - `apps/<project>/src/main/res/values*/strings.xml`

## Anclaje obligatorio a strategy matrix

Para cada `locale` generado, leer y usar explícitamente su fila en:

- `docs/fichas/<project-id>/strategy-matrix.md`
- o `docs/fichas/<project-id>/conversion-strategy.md` si reemplaza al matrix

No se permite generar múltiples locales a partir de un único copy base en inglés.

Antes de redactar cada locale, extraer de su fila al menos:

- propuesta de valor principal,
- deseo principal,
- casos de uso clave,
- qué evitar,
- términos ASO.
- sistema de color por locale usando columnas explícitas del matrix:
  - `Background base`
  - `Background secondary`
  - `Accent color`
  - `Title color`
  - `Subline color`
  - `Bullet color`

Ese anclaje debe reflejarse en el resultado final. Si dos locales terminan con el mismo copy visible de piezas, se considera fallo.

## Anclaje obligatorio de color por locale

Para cada locale, los colores de `Visual System`, `Feature Graphic` y `Screenshot 1..N` deben salir de la referencia del mismo locale:

- prioridad 1: fila del locale en `strategy-matrix.md` o `conversion-strategy.md` con columnas explícitas de color,
- prioridad 2: `*.golden.md` del mismo locale solo como fallback cuando falten campos en matrix.

No usar paleta de `en-US` para otros locales salvo que la estrategia aprobada declare explícitamente una paleta global compartida y sin overrides por locale.
Si falta cualquiera de estos campos para el locale (`Background base`, `Background secondary`, `Accent color`, `Title color`, `Subline color`, `Bullet color`), detener y reportar la falta en vez de heredar colores de otro mercado.

## Reglas visuales del matrix (obligatorias)

Si `strategy-matrix.md` incluye sección `Visual Generation Rules`, aplicarla literalmente en la generación del locale.

Como mínimo, reflejar en la ficha:

- zona de copy estable, oscura y legible,
- sin paneles brillantes detrás de títulos,
- sin glows rojos saturados detrás del headline,
- sin patrones densos detrás del copy,
- secuencia visual `problema → flujo simple → control → privacidad`,
- prueba de confianza explícita: procesamiento local, sin cuentas, sin subidas.

## Manejo de contradicciones

Los documentos estratégicos aprobados mandan sobre el tono, ángulo de conversión, visuales y riesgos.

El código manda sobre capacidades reales.

Si la estrategia promete algo que no puede confirmarse en código/configuración:

- no modificar la estrategia,
- no inventar soporte,
- detenerse si el riesgo es alto,
- o dejar la incertidumbre documentada en `Notes / Assumptions` si el riesgo es bajo.

Nunca corregir la estrategia desde la skill. Solo reportar la contradicción.

## Prueba de lectura real (obligatoria)

Cada ejecución debe demostrar lectura real de config+audit antes de escribir:

- Citar en la respuesta final al menos 1 hallazgo de `strategy-matrix.md` o `conversion-strategy.md` para el locale.
- Citar al menos 1 hallazgo de `conversion-audit.md`.
- Si no puede citar ambos, abortar generación de ficha.

## Ubicación de salida

Crear 1 archivo por proyecto/locale en:

`docs/fichas/<project-id>/<locale>.md`

No sobrescribir una ficha existente salvo solicitud explícita de regeneración/actualización.
Si ya existe y no se pidió reemplazo, crear:

`docs/fichas/<project-id>/<locale>.draft.md`

La generación masiva solo debe crear o actualizar fichas finales por locale.

No crear ni actualizar durante este flujo:

- `docs/fichas/<project-id>/creative-brief.md`
- `docs/fichas/<project-id>/strategy-matrix.md`
- `docs/fichas/<project-id>/conversion-strategy.md`
- `docs/fichas/<project-id>/conversion-audit.md`
- `docs/fichas/<project-id>/*.golden.md`

## Reglas de Play Store (obligatorias)

- App name: máximo 30 caracteres.
- Short description: máximo 80 caracteres.
- Long description: máximo 4000 caracteres.

Siempre incluir conteo de caracteres en la ficha.

No prometer features no implementadas.
Solo mencionar privacidad, offline, cuenta, compatibilidad y formatos si se confirma en código/configuración o si está autorizado explícitamente en los documentos estratégicos aprobados y no contradice el código.

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
- bullet color:
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

## Screenshot 6
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

No agregar secciones top-level extra salvo necesidad justificada por la ficha golden o por los documentos estratégicos aprobados.

Si el creative brief o golden files del proyecto definen 4, 5 o 6 screenshots, seguir exactamente la estrategia aprobada del proyecto.
`Screenshot 6` debe incluirse cuando esté definido en la referencia golden o en los documentos estratégicos aprobados.

## Campos visuales y wrappers permitidos

Wrappers base:

- `e-reader emulado (sin branding)`
- `teléfono android emulado`
- `tablet emulada`
- `captura directa de app`
- `composición gráfica con dispositivo + bullets`
- `composición tipográfica + bullets (sin dispositivo)`

Para piezas de confianza (privacidad/local/offline/ad-free), no exigir captura real de pantalla de ajustes/privacidad; se permite y se prefiere composición gráfica de confianza.
Para `Screenshot 6`, cuando la prueba de confianza no depende de UI real, usar `composición tipográfica + bullets (sin dispositivo)` y evitar mockups de teléfono/e-reader.
Solo usar `teléfono android` en `Screenshot 6` si el documento estratégico aprobado exige explícitamente mostrar UI.

Si el proyecto es Android-only, cualquier wrapper de teléfono debe especificar explícitamente `teléfono android`.
En proyectos Android-only, evitar mockups de iPhone/iOS.
Para `Screenshot 4` cuando representa preview interna de la app, usar wrapper de `teléfono android emulado`, no `captura directa de app`.

Regla de precisión de dispositivo:

- No usar `dispositivo` de forma ambigua en copy final de ficha.
- Cuando aplique, especificar tipo: `teléfono`, `tablet` o `e-reader`.
- En piezas visuales, evitar `kindle` como tipo de mockup para prevenir branding en generación.
- En secciones visuales, `wrapper` debe indicar tipo concreto; evitar descripciones genéricas.

Para apps no e-reader, adaptar contexto sin cambiar nombres de campos.

Tamaños por defecto (si el usuario no da otros):

- fondo vertical: `1994x3456 px`
- screenshot teléfono: `972x2106 px`
- imagen en e-reader emulado: `1313x1751 px`
- gráfico horizontal tipo feature: `1024x500 px`

Incluir estos tamaños explícitamente dentro de `fondo:` e `imagen:`.

## Localización selectiva para piezas visuales

Objetivo: localizar solo el texto que aparece escrito en la imagen/captura, no todo el bloque técnico de producción.

En `Feature Graphic` y `Screenshot 1..6`:

- Campos que SÍ se localizan al idioma destino:
  - `titulo:`
  - `subline:`
  - `bullets:` (cuando exista)
- Campos que NO se localizan por defecto (mantener idioma de trabajo del documento):
  - `wrapper:`
  - `fondo:`
  - `imagen:`
  - `conversion intent:`
  - reglas técnicas de color/tamaño/composición

Para `locale != en-US`, está prohibido dejar en inglés literales de overlay como:

- `IMAGE OR SCRATCH TO KINDLE COVER`
- `Choose source, adjust, preview, save`
- `TURN IMAGE INTO A KINDLE COVER`
- `Image or scratch start`
- `Model-aware crop and preview`
- `Save or share final cover`

## Localización real por idioma

No reutilizar concepto idéntico entre locales cambiando solo texto, salvo que los documentos estratégicos aprobados indiquen una estrategia global común.

Para `locale != en-US`, no usar fallback en inglés en texto visible de la ficha.
Si la fila del matrix viene en inglés para un locale no inglés, traducir y adaptar el texto al idioma objetivo manteniendo significado, claims y límites.

Cada locale debe adaptar, cuando corresponda:

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

## Deliverables permitidos

La skill puede generar o actualizar:

- `docs/fichas/<project-id>/<locale>.md`
- `docs/fichas/<project-id>/<locale>.draft.md`

Ningún otro archivo puede ser creado, modificado o eliminado por esta skill.

La skill no puede generar o actualizar:

- `docs/fichas/<project-id>/creative-brief.md`
- `docs/fichas/<project-id>/strategy-matrix.md`
- `docs/fichas/<project-id>/conversion-strategy.md`
- `docs/fichas/<project-id>/conversion-audit.md`
- `docs/fichas/<project-id>/*.golden.md`

## Checklist de validación final

- ruta correcta: `docs/fichas/<project-id>/<locale>.md`
- solo se leyeron fuentes allowlist (config estratégica + audit + config locales)
- documentos estratégicos aprobados leídos como solo lectura
- ningún documento estratégico base creado o modificado
- ningún archivo fuera de deliverables fue escrito
- límites de caracteres cumplidos
- promesas alineadas con implementación real
- claims alineados con creative brief, strategy matrix/conversion strategy, conversion audit y golden files
- diferenciación regional real, salvo estrategia global común aprobada
- colores anclados al locale (background base/secondary, accent, title, subline, bullet), sin heredar `en-US` por defecto
- reglas de `Visual Generation Rules` aplicadas cuando existan en matrix
- en piezas visuales, `titulo/subline/bullets` localizados para `locale != en-US`
- en piezas visuales, sin copy overlay duplicado literal entre locales
- sin uso ambiguo de `dispositivo` cuando corresponde `teléfono/tablet/e-reader`
- screenshots con ángulos distintos según estrategia aprobada
- feature graphic con intención de conversión clara
- sistema visual con contraste seguro para área de copy
- evidencia de lectura real reportada (matrix/strategy + audit)
- incertidumbres documentadas en `Notes / Assumptions`

## Comportamiento de respuesta

Al terminar, responder con un resumen breve de archivos creados/actualizados.
No pegar el contenido completo de todas las fichas salvo que el usuario lo pida.

Si el flujo se detuvo por falta de documentos estratégicos, responder con la lista exacta de archivos faltantes y no generar fichas.
