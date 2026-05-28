---
name: fichas
user-invocable: true
description: "Crear/actualizar fichas Play Store SEO/ASO por proyecto+locale, usando creative brief, strategy matrix/conversion strategy, conversion audit y golden files aprobados como insumos de solo lectura. Leer docs/utilities/<short-name>/ sin modificar. Use when user asks 'genera fichas', 'crea ficha Play Store', or localized listing copy/visual direction for ecc/ccfk/other locales."
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

1. Documentos estratégicos aprobados en `docs/fichas/<project-id>/`:
   - `creative-brief.md`
   - `strategy-matrix.md` o `conversion-strategy.md`
   - `conversion-audit.md`
   - `*.golden.md`
2. Código y configuración reales:
   - `apps/<project>/**`
   - `apps/<project>/src/assets/i18n/**/*.json`
   - `apps/<project>/src/main/res/values*/strings.xml`
   - `packages/**` para capacidades compartidas reales
3. Contexto documental secundario:
   - `docs/utilities/<short-name>/**` solo lectura, no modificar
   - `README.md` y `docs/**` relevantes, siempre que no contradigan los documentos estratégicos aprobados

`docs/utilities/<short-name>/` puede estar vacío por ahora. Si no hay contenido utilizable, continuar solo si los documentos estratégicos aprobados sí existen.

## Manejo de contradicciones

Los documentos estratégicos aprobados mandan sobre el tono, ángulo de conversión, visuales y riesgos.

El código manda sobre capacidades reales.

Si la estrategia promete algo que no puede confirmarse en código/configuración:

- no modificar la estrategia,
- no inventar soporte,
- detenerse si el riesgo es alto,
- o dejar la incertidumbre documentada en `Notes / Assumptions` si el riesgo es bajo.

Nunca corregir la estrategia desde la skill. Solo reportar la contradicción.

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

No agregar secciones top-level extra salvo necesidad justificada por la ficha golden o por los documentos estratégicos aprobados.

Si el creative brief o golden files del proyecto definen 4 screenshots en lugar de 5, seguir la estrategia aprobada del proyecto y omitir `Screenshot 5` solo cuando esa decisión esté explícita o consistentemente reflejada en esos documentos.

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

No reutilizar concepto idéntico entre locales cambiando solo texto, salvo que los documentos estratégicos aprobados indiquen una estrategia global común.

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

La skill no puede generar o actualizar:

- `docs/fichas/<project-id>/creative-brief.md`
- `docs/fichas/<project-id>/strategy-matrix.md`
- `docs/fichas/<project-id>/conversion-strategy.md`
- `docs/fichas/<project-id>/conversion-audit.md`
- `docs/fichas/<project-id>/*.golden.md`

## Checklist de validación final

- ruta correcta: `docs/fichas/<project-id>/<locale>.md`
- documentos estratégicos aprobados leídos como solo lectura
- ningún documento estratégico base creado o modificado
- límites de caracteres cumplidos
- promesas alineadas con implementación real
- claims alineados con creative brief, strategy matrix/conversion strategy, conversion audit y golden files
- diferenciación regional real, salvo estrategia global común aprobada
- screenshots con ángulos distintos según estrategia aprobada
- feature graphic con intención de conversión clara
- sistema visual con contraste seguro para área de copy
- incertidumbres documentadas en `Notes / Assumptions`

## Comportamiento de respuesta

Al terminar, responder con un resumen breve de archivos creados/actualizados.
No pegar el contenido completo de todas las fichas salvo que el usuario lo pida.

Si el flujo se detuvo por falta de documentos estratégicos, responder con la lista exacta de archivos faltantes y no generar fichas.
