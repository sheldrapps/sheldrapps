---
target: "formulario de metadatos de múltiples EPUB: densidad y edición"
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\apps\\sheldrapps\\packages\\ui-theme\\src\\lib\\components\\epub-metadata-editor\\epub-metadata-editor.view.html"
target_fingerprint: "sha256:24e5db4bdadb0ed1ae11a0807820792c86d6d6f163559595273c740976dff5d8"
target_path: "C:\\apps\\sheldrapps\\packages\\ui-theme\\src\\lib\\components\\epub-metadata-editor\\epub-metadata-editor.view.html"
timestamp: 2026-10-02T17-35-34Z
slug: ata-editor-epub-metadata-editor-view-html-9304e2d2
---
Method: dual-agent (A: /root/metadata_form_review · B: /root/metadata_form_detector)

# Revisión del formulario de metadatos para múltiples EPUB

## Recomendación
Mantener los campos poblados visibles y editables en línea, con todos los EPUB abiertos. No usar “tap to edit” como patrón principal: ocultaría valores útiles para comparar y agregaría un paso antes de cada cambio. Reducir primero la densidad mediante menos espacio y bordes repetidos dentro de cada sección; mantener campos avanzados detrás de los disclosures actuales.

Evitar una card exterior por EPUB. Las secciones internas ya usan cards y una card contenedora puede confundirse con otro grupo del formulario. Para separar archivos, usar encabezado claro con nombre y versión, seguido de un divisor fuerte y espacio moderado.

## Diseño específico
La interfaz es claramente para EPUB por las versiones, autores, sujetos y diferencias EPUB 2/3. Aun así, el ritmo visual se siente como una pila larga de formularios genéricos. El problema principal no es que todos estén abiertos, sino la densidad repetida y el chrome de cada sección.

## Salud de diseño
Modo Operate. Puntuación: **23/40 — aceptable**.

| # | Heurística | Puntuación | Hallazgo |
|---|---|---:|---|
| 1 | Visibilidad del estado | 2/4 | Se ve la versión, pero no un estado claro de cambios o guardado. |
| 2 | Correspondencia con el mundo real | 3/4 | Los campos son reconocibles; algunos términos avanzados son técnicos. |
| 3 | Control y libertad | 2/4 | Hay acciones principales, pero quitar una fila no muestra deshacer. |
| 4 | Consistencia | 3/4 | Los patrones se repiten; colaboradores hereda el rótulo “Detalles del autor”. |
| 5 | Prevención de errores | 2/4 | Idioma tiene guía; fecha e identificador tienen poca orientación visible. |
| 6 | Reconocimiento antes que recuerdo | 3/4 | Los valores están visibles; lo avanzado está plegado. |
| 7 | Flexibilidad y eficiencia | 2/4 | Tener varios archivos abiertos ayuda a comparar, pero no hay edición masiva. |
| 8 | Estética y minimalismo | 2/4 | La repetición de cards y espaciado alarga la pantalla. |
| 9 | Recuperación de errores | 2/4 | Los errores son inline; quitar filas no ofrece recuperación evidente. |
| 10 | Ayuda y documentación | 2/4 | Hay guía contextual para idioma; falta contexto para otros campos técnicos. |
| **Total** | | **23/40** | **Aceptable** |

## Carga cognitiva
**4 fallos de 8 — alta.** Falla el foco único por compartir espacio entre tres formularios largos; hay cinco secciones repetidas por archivo; los grupos y campos tienen pesos visuales similares; y todos los metadatos poblados compiten a la vez. Funcionan la agrupación semántica y la divulgación progresiva de campos avanzados.

En la fixture revisada, cada EPUB tiene unos diez controles visibles (once para EPUB 2), alrededor de treinta entre los tres formularios. Cada uno repite cinco secciones.

## Lo que funciona
- Los datos existentes están precargados para revisar y corregir.
- El nombre y la versión ayudan a identificar cada EPUB.
- Los campos menos frecuentes ya están detrás de disclosures.

## Problemas prioritarios
1. **[P1] Densidad repetida.** Cinco secciones y unos diez controles visibles por archivo hacen largo el conjunto. Reducir espacios y chrome repetido dentro de las secciones. `$impeccable layout`.
2. **[P1] Falta estado de cambios.** En un formulario largo no es obvio qué cambió o quedó guardado. Dar una señal por archivo. `$impeccable harden`.
3. **[P2] Borrar fila sin deshacer.** La acción es inmediata y el icono de papelera es la señal visible. Añadir recuperación o hacer la acción más explícita. `$impeccable harden`.
4. **[P2] Términos avanzados técnicos.** Identificador, origen, relación y cobertura necesitan ayuda breve donde aparecen. `$impeccable clarify`.
5. **[P3] Límite archivo/formulario.** Una card exterior adicional puede confundirse con una sección interna. Usar encabezado de archivo más divisor, sin otra card.

## Personas
- **Casey, usuario móvil con interrupciones:** mucho scroll repetido, sin señal clara de progreso o estado guardado.
- **Sam, teclado/lector de pantalla:** controles repetidos alargan la navegación; la acción de quitar fila aparece como icono.
- **Alex, usuario avanzado:** los formularios abiertos facilitan comparar, pero no hay acción para cambiar metadatos compartidos entre archivos.

## Observaciones menores
“Derechos y copyright” se repite como título y etiqueta del campo; colaboradores usa el rótulo “Detalles del autor”. Los nombres largos deben comprobarse en el reflujo de Android. En la fixture, la versión detectada y el badge EPUB 2/3 podrían leerse como incongruentes si no se explica su relación.

## Preguntas a considerar
- ¿Los usuarios corrigen uno o dos campos por archivo, o revisan la mayoría?
- ¿Ayudaría una acción de edición masiva para metadatos compartidos conservando abiertos los formularios?
- ¿Qué campos avanzados suelen modificar los usuarios y cómo explicar su efecto?
