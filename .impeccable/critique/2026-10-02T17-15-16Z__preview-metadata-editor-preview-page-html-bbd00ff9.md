---
target: separación visual de cada EPUB en edición múltiple
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\apps\\sheldrapps\\apps\\epub-metadata-editor\\src\\app\\pages\\metadata-editor-preview\\metadata-editor-preview.page.html"
target_fingerprint: "sha256:22c82010e304e6d8d2180fa3680e6495ed0294f66d4c8c276d150980eb1cdceb"
target_path: "C:\\apps\\sheldrapps\\apps\\epub-metadata-editor\\src\\app\\pages\\metadata-editor-preview\\metadata-editor-preview.page.html"
timestamp: 2026-10-02T17-15-16Z
slug: preview-metadata-editor-preview-page-html-bbd00ff9
---
# Crítica de separación de archivos

**Recomendación:** usa un divisor fuerte con una franja de encabezado para cada EPUB; no envuelvas cada formulario en otra card. Los formularios ya contienen varias cards internas. Añadir una card exterior produciría una pila alta de “cards dentro de cards” y haría más pesada la pantalla.

La franja debe reunir el nombre del archivo y su versión/formato. Un separador y espacio superior claros marcarían dónde termina un EPUB y empieza el siguiente, sin plegar los formularios. Eso respeta la preferencia del usuario de mantenerlos todos abiertos.

**Evaluaciones independientes:** diseño visual y detector automatizado. La pantalla sí identifica cada archivo y mantiene consistentes las secciones internas, pero en el preview actual el límite entre formularios depende casi solo del nombre y del espacio; al desplazarse, se pierde la identidad del archivo. La especificidad visual obtiene **2/5**: los nombres, versiones y badges de EPUB la anclan al producto, aunque la estructura general sigue pareciendo un formulario genérico.

## Salud de diseño

| Heurística | Puntuación | Hallazgo principal |
|---|---:|---|
| Visibilidad del estado | 2/4 | Muestra total y versión, pero no estado de cambios por archivo. |
| Correspondencia con el mundo real | 3/4 | Metadatos y nombres son reconocibles; “BCP 47” sigue siendo técnico. |
| Control y libertad | 2/4 | “Listo” está disponible; navegar por una pila larga es lento. |
| Consistencia | 3/4 | Las secciones y controles se repiten de forma uniforme. |
| Prevención de errores | 2/4 | Hay ayuda para idioma; identificador y fecha tienen poca guía visible. |
| Reconocimiento | 2/4 | El nombre identifica el archivo al inicio, pero desaparece al desplazarse. |
| Flexibilidad y eficiencia | 2/4 | Se pueden editar varios registros, pero no hay salto visible por archivo. |
| Estética y minimalismo | 2/4 | Formularios altos y límites débiles entre archivos. |
| Recuperación de errores | 1/4 | El preview no muestra señales claras de errores o recuperación. |
| Ayuda y documentación | 2/4 | Hay una pista útil para idioma; faltan ayudas contextuales en otros campos. |
| **Total** | **21/40 — Aceptable** | Evaluación limitada en manejo de errores porque es una pantalla de preview estática. |

## Carga cognitiva

**Alta: 5 de 8 comprobaciones fallan.** Hay seis campos básicos visibles en cada formulario y quince secciones repetidas entre tres EPUB. El problema principal es la agrupación e identidad por archivo, no que estén todos abiertos. No aparece un menú con más de cuatro opciones; sí hay más de cuatro campos y acciones que compiten por atención en la primera vista.

## Lo que funciona

- Los nombres de archivo como encabezados dan identidad a cada bloque.
- La versión detectada y el badge EPUB 2/3 ayudan a distinguir formatos.
- Las cards internas dan una estructura consistente a cada grupo de metadatos.

## Prioridades

1. **[P1] Los límites entre EPUB son débiles.** Un nombre y un espacio pueden confundirse con otra sección. Añadir una regla divisoria y una franja compacta que agrupe nombre, versión y formato. `$impeccable layout`.
2. **[P1] Se pierde la identidad al desplazarse.** Mantener el encabezado de cada archivo visualmente claro; valorar que permanezca visible mientras se recorre su formulario. `$impeccable layout`.
3. **[P2] El formulario es largo y repetitivo.** Mantener los formularios abiertos, pero separar claramente los bloques por archivo y conservar la divulgación progresiva de campos avanzados. `$impeccable distill`.
4. **[P2] Parte de la terminología es técnica.** “BCP 47” tiene ayuda, pero identificador y fecha podrían necesitar ejemplos breves. `$impeccable clarify`.

## Personas

- **Alex, usuario experto:** editar tres formularios completos implica mucho desplazamiento; no hay acceso directo visible a un EPUB concreto.
- **Jordan, primer uso:** “BCP 47” y “esquema del identificador” presuponen conocimiento técnico; solo el campo de idioma tiene orientación clara.
- **Sam, teclado/lector de pantalla:** los encabezados y campos aparecen en el árbol accesible. La pantalla aún ofrece pocas señales de progreso o cambios guardados por archivo.

## Observaciones menores

El preview revisado tiene ancho de escritorio; conviene comprobar los nombres largos y el reflujo en el ancho real de Android. El separador debe seguir siendo reconocible en móvil sin depender solo del color.

## Questions to Consider

- Cuando el usuario se desplaza por un formulario, ¿qué señal le indica qué EPUB está cambiando?
- ¿Puede el encabezado compacto mantener la identidad del archivo sin convertir cada formulario en una card exterior?
- ¿Qué campos requieren el mismo nivel de prominencia que título y autor?
