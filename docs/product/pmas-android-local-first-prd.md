# PRD — PMAS Android local-first: fiabilidad, archivos y rendimiento

**Producto:** PDF Merger & Splitter (PMAS) Android  
**Estado:** Propuesto  
**Objetivo de release:** cerrar los hallazgos de auditoría sin ampliar la categoría del producto  
**Decisión de producto:** el criterio de split será **máximo de páginas por PDF**. Se elimina de la experiencia pública el límite aproximado en MB.

## 1. Resumen

PMAS es una utilidad Android para crear nuevos PDF a partir de documentos PDF existentes: unir varios archivos ordenados o dividir uno por estructura y páginas. La base nativa ya resuelve las operaciones principales y publica archivos en `Documents/PdfMergerAndSplitter`, pero el producto aún presenta cuatro fallas de confianza:

1. La ficha promete máximo de páginas, mientras que la app calcula un límite aproximado de MB.
2. “Mis PDF” usa un índice de `localStorage`; renombrar o borrar no modifica el archivo real y se pierden las referencias tras limpiar datos o reinstalar.
3. La app no comunica las limitaciones detectadas al reescribir formularios, firmas, etiquetas de página o enlaces internos.
4. Los merges grandes cambian de motor y dejan de respetar las opciones de marcadores.

Este release convierte PMAS en una utilidad **local-first verificable**: la lectura, transformación, vista, compartición, renombrado y eliminación de documentos suceden en el dispositivo. No se sube contenido, URI, nombre, miniatura ni metadatos de un PDF a ningún servidor. La implementación prioriza escritura transaccional, lectura incremental, disco temporal controlado y un presupuesto de memoria estricto para evitar OOM.

## 2. Problema a resolver

El valor de PMAS depende de que el resultado sea predecible y permanezca bajo control del usuario. Hoy el archivo generado sí se publica localmente, pero la biblioteca es una representación incompleta: puede mostrar un nombre distinto al del archivo real y puede “borrar” solo su tarjeta. Esto rompe la expectativa de gestión local.

Además, la promesa de split debe ser determinista. Un usuario entiende “máximo de 20 páginas por PDF”; no puede verificar ni confiar en una estimación de MB que varía por fuentes, imágenes y objetos compartidos.

Por último, los PDF con rasgos avanzados necesitan transparencia: el archivo puede ser válido, pero una firma digital deja de ser válida y un formulario interactivo no se reconstruye por completo. El usuario debe verlo antes de dar por terminado el flujo.

## 3. Objetivos

### Objetivos de negocio y producto

- Mantener PMAS como una utilidad focalizada de merge y split; no convertirla en lector, editor, compresor, OCR, conversor, reparador, firmador ni servicio cloud.
- Hacer que “Mis PDF” represente los PDF reales publicados por PMAS en el almacenamiento local, incluso después de reiniciar, reinstalar o limpiar el almacenamiento de la WebView.
- Alinear UI, tienda, traducciones y comportamiento con “máximo de páginas por archivo”.
- Hacer visibles las advertencias de fidelidad antes de que la persona salga del flujo.
- Preservar opciones de marcadores también en merges grandes, con degradación explícita solo si una característica no puede reconstruirse.

### Objetivos técnicos no negociables

- Lectura y escritura de PDF 100% local en Android.
- Cero carga de archivos o contenido PDF a red.
- Ninguna operación debe cargar el PDF completo en memoria Java, JavaScript, Base64 o `ArrayBuffer`.
- Una operación grande debe fallar temprano por espacio insuficiente o cancelar limpiamente, nunca terminar el proceso por OOM.
- Los archivos publicados deben ser atómicos: un fallo no deja resultados parciales visibles.

## 4. No objetivos

- Garantizar preservación perfecta de firmas, AcroForms, marcadores complejos, anotaciones, enlaces, adjuntos, etiquetas de página o acciones PDF avanzadas.
- Desbloquear, reparar o aceptar PDFs cifrados sin contraseña.
- Añadir sincronización, cuentas, backup cloud o telemetría de documentos.
- Garantizar un tamaño máximo exacto en MB.
- Añadir edición de texto o páginas fuera de merge, split y portada opcional.
- Cambiar la experiencia web en este release; el contrato de producto se aplica a Android nativo. La web puede mantener un aviso explícito de capacidades reducidas.

## 5. Personas y casos de uso

| Persona | Necesidad | Resultado esperado |
| --- | --- | --- |
| Estudiante | Dividir un temario largo cada N páginas | PDFs consecutivos de hasta N páginas, sin perder el original |
| Personal administrativo | Unir anexos en un orden específico | Un PDF nuevo, con el orden indicado y marcadores según la opción elegida |
| Profesional móvil | Abrir, compartir, renombrar o borrar un resultado | La acción afecta al archivo físico local, no solo a una tarjeta |
| Persona con documento sensible | Procesar un PDF sin exponerlo | Contenido tratado exclusivamente en el dispositivo |

## 6. Alcance funcional

### 6.1 Split por máximo de páginas

Se sustituye el método visible `maximum-file-size` por `maximum-pages-per-file`.

**Comportamiento requerido**

- La persona elige un entero `N` entre 1 y el total de páginas.
- Cada resultado contiene como máximo `N` páginas de origen.
- Las páginas permanecen en orden y cada página de origen aparece exactamente una vez.
- La última parte puede contener menos de `N` páginas.
- Si se añade portada, cada resultado contiene una portada adicional; el límite `N` sigue refiriéndose solo a páginas de origen.
- La pantalla de confirmación muestra rangos exactos y número de páginas, no estimaciones de MB.
- El flujo exige al menos dos resultados; si `N` no divide el documento en dos o más, debe mostrar una explicación accionable.

**Migración**

- No se persisten preferencias de tamaño de split; por tanto no se requiere migración de datos.
- Se eliminan copy, claves i18n, tests y capturas que hablen de MB, tamaño aproximado o “maximum file size”.
- La ficha de Play Store se mantiene con “máximo de páginas por archivo”.

### 6.2 Biblioteca local “Mis PDF”

La biblioteca será una vista derivada de MediaStore, no un índice propietario en `localStorage`.

**Comportamiento requerido**

- Al entrar o refrescar, listar PDFs en `Documents/PdfMergerAndSplitter` a través de MediaStore.
- Usar el `content://` estable de MediaStore como identidad del documento. No identificar por nombre de archivo.
- Mostrar nombre, tamaño, fecha de modificación y miniatura opcional de la primera página.
- Si no hay archivo físico, no mostrar registro obsoleto.
- Después de reinstalar o borrar datos de la app, volver a descubrir los documentos locales existentes.
- Renombrar actualiza `DISPLAY_NAME` del documento físico y actualiza la UI con la URI resultante.
- Borrar pide confirmación y elimina el documento físico mediante MediaStore. Si falla, la tarjeta permanece y se informa el error.
- Abrir usa un `ACTION_VIEW` nativo con permiso temporal de lectura y selector de aplicaciones compatibles.
- Compartir usa un `ACTION_SEND` nativo con `EXTRA_STREAM`, MIME `application/pdf` y permiso temporal de lectura; nunca comparte una URI como texto.
- La biblioteca no intenta administrar PDFs que la app no publicó fuera de su carpeta pública.

**Contrato del plugin nativo**

```ts
type LocalPdf = {
  uri: string;
  displayName: string;
  sizeBytes: number;
  modifiedAtMillis: number;
};

listLocalPdfs(): Promise<{ files: LocalPdf[] }>;
renameLocalPdf(options: { uri: string; displayName: string }): Promise<LocalPdf>;
deleteLocalPdf(options: { uri: string }): Promise<void>;
openLocalPdf(options: { uri: string }): Promise<void>;
shareLocalPdf(options: { uri: string; title: string }): Promise<void>;
```

Las APIs deben recibir URI, no ruta ni nombre. Cada una valida que la URI pertenezca a MediaStore, tenga MIME PDF y esté dentro de la carpeta PMAS antes de actuar.

### 6.3 Advertencias de fidelidad

**Detección nativa requerida**

- AcroForm presente: `ACROFORM_NOT_RECONSTRUCTED`.
- Firma digital presente: `SIGNATURES_INVALIDATED_BY_REWRITE`.
- Etiquetas de página: `PAGE_LABELS_REQUIRE_MANUAL_REBUILD`.
- Enlace interno cuyo destino no existe en una parte: `INTERNAL_LINK_TARGET_REMOVED`.
- Merge grande con capacidad limitada: un warning específico que enumere con precisión qué no se reconstruyó.

**Experiencia requerida**

- Antes de publicar resultados, mostrar una hoja de revisión si existen warnings.
- Cada warning explica impacto, no detalles internos: por ejemplo, “Las firmas digitales del documento resultante ya no serán válidas”.
- La persona puede volver al flujo o continuar con “Crear archivos de todos modos”.
- Las advertencias se conservan en el resultado de sesión mientras la pantalla de éxito esté activa; no se guardan en red ni se incluyen en el archivo PDF.
- Sin warnings, se conserva el flujo directo actual.

### 6.4 Merge grande con marcadores

Para cualquier tamaño de entrada, la opción elegida en UI debe definir el resultado:

- **Documentos y marcadores:** un marcador por documento y marcadores de origen reconstruibles.
- **Solo documentos:** un marcador por documento, sin marcadores de origen.
- **Marcadores originales:** reconstruir marcadores de origen que tengan destino de página resoluble.

Para impedir OOM, el merge grande no debe mantener todos los `PDDocument` fuente abiertos. Antes del merge se construye secuencialmente un `BookmarkManifest` compacto: título, profundidad, página de destino y offset por fuente. Después se realiza el merge con almacenamiento temporal y se aplica el manifest sobre el resultado usando memoria temporal en disco. Si una entrada no tiene destino resoluble, se omite y se agrega un warning de fidelidad deduplicado.

## 7. Arquitectura local-first

```mermaid
flowchart LR
  A["Selector Android / URI local"] --> B["Copia incremental a scratch privado"]
  B --> C["PDFBox con memoria temporal en disco"]
  C --> D["PDF temporal validado"]
  D --> E["Publicación MediaStore atómica"]
  E --> F["Documents/PdfMergerAndSplitter"]
  F --> G["Mis PDF: lectura MediaStore"]
  G --> H["Abrir / Compartir / Renombrar / Borrar nativos"]
```

### 7.1 Frontera de privacidad

- El plano de datos PDF no debe ejecutar HTTP, WebSocket, analytics, publicidad, compras ni callbacks remotos.
- Ads, consentimiento y billing pueden coexistir en la app, pero nunca reciben URI, nombre, tamaño, miniatura, contenido, metadatos o warnings de documentos.
- Los logs de producción no incluyen rutas, URIs, nombres ni contenido de PDF.
- El selector usa `ACTION_OPEN_DOCUMENT`; se copia a scratch privado con acceso de solo lectura al origen.
- Los resultados se publican exclusivamente por MediaStore con `IS_PENDING=1` hasta terminar copia y validación.

### 7.2 Fuente de verdad de archivos

- **Fuente de verdad:** MediaStore, carpeta pública `Documents/PdfMergerAndSplitter`.
- **Estado efímero:** sesión de operación y scratch privado.
- **No usar como fuente de verdad:** `localStorage`, Preferences, Config JSON o cache de WebView.
- Los metadatos enriquecidos que no existan en MediaStore son opcionales y deben poder regenerarse; nunca bloquean abrir, compartir, renombrar, borrar o listar.

### 7.3 Miniaturas

- Generar solo después de que la lista sea visible y con cola de concurrencia 1.
- Renderizar únicamente la primera página, RGB, con lado máximo de 256 px y subsampling habilitado.
- Guardar cache local por URI + `DATE_MODIFIED` + tamaño; limpiar por LRU y límite de disco.
- Si falla o no existe miniatura, mostrar placeholder. La lista nunca espera a la miniatura.

## 8. Presupuesto de rendimiento y memoria

### 8.1 Reglas obligatorias de OOM

- Prohibidos `readAllBytes`, `File.arrayBuffer`, `Blob` completo, Base64 completo, `ByteArrayOutputStream` sin límite y paralelismo de documentos grandes.
- Copiar cada entrada con buffer fijo de 256 KiB; una sola copia activa por sesión.
- Toda carga PDFBox usa configuración respaldada por archivo temporal, nunca configuración predeterminada en memoria.
- Merge: no abrir más de un PDF fuente a la vez durante la preparación; el merge secuencial usa scratch disk.
- Split: procesar un resultado a la vez, validarlo, publicarlo y liberar recursos antes del siguiente.
- Portada: límite estricto de 64 MiB de archivo, decodificación muestreada y dimensión máxima configurable; reciclar bitmap en todos los caminos de éxito, fallo y cancelación.
- Toda colección de páginas, rangos, marcadores y planes se representa como datos compactos; no se crean miniaturas ni objetos de página para todas las páginas si no son necesarios.
- JavaScript solo orquesta; la manipulación binaria permanece en Android nativo.

### 8.2 Presupuesto de disco antes de empezar

Antes de importar o transformar, calcular y comunicar una estimación conservadora:

`espacio requerido = entradas privadas pendientes + salida máxima estimada + scratch de PDFBox + portada + margen de seguridad`

Reglas:

- Usar suma segura con saturación a `Long.MAX_VALUE`.
- Reservar un margen mínimo fijo y uno porcentual para escritura temporal.
- Si no hay espacio suficiente, cancelar antes de copiar el siguiente archivo y mostrar el espacio requerido/disponible sin revelar rutas.
- El resultado parcial de split nunca se publica; si cualquier parte falla, revertir todos los elementos MediaStore creados en esa sesión.
- Scratch se borra al terminar, cancelar, volver atrás o recibir destrucción de Activity. Un limpiador de arranque elimina sesiones antiguas de forma conservadora.

### 8.3 Objetivos de velocidad

- La lista de “Mis PDF” debe mostrar nombres y acciones sin bloquear por miniaturas.
- La importación debe comenzar a validar desde la copia local, no esperar un análisis visual completo.
- El progreso nativo reporta fases: importar, analizar, preparar marcadores, copiar páginas, validar, publicar.
- Actualizar progreso como máximo cada 100 ms o cuando cambie el porcentaje para evitar saturar el bridge WebView.
- La UI mantiene la pantalla encendida durante una operación activa, pero no reduce brillo ni intercepta gestos fuera del overlay de progreso.

## 9. Manejo de errores

| Código | Momento | Mensaje/acción para usuario |
| --- | --- | --- |
| `PDF_TOO_LARGE` | importación | Elegir un PDF menor o liberar espacio |
| `NO_SPACE` | preflight, copia o escritura | Liberar espacio y volver a intentar; no se publica nada parcial |
| `PDF_PASSWORD_REQUIRED` | análisis | Abrir una copia sin contraseña o quitar protección fuera de PMAS |
| `PDF_ENCRYPTED` | transformación | No se procesa el archivo protegido |
| `INVALID_PAGE_RANGE` | split | Volver a elegir páginas o máximo de páginas |
| `PUBLIC_EXPORT_FAILED` | publicación | El resultado temporal se limpia y no se añade a la biblioteca |
| `LOCAL_DOCUMENT_NOT_FOUND` | abrir/compartir/renombrar/borrar | Refrescar “Mis PDF”; retirar la tarjeta obsoleta |
| `LOCAL_DOCUMENT_ACCESS_DENIED` | acción sobre archivo | Explicar permiso/acceso y ofrecer refrescar |
| `OPERATION_CANCELLED` | cancelación | Limpiar scratch y resultados pendientes; conservar fuentes |

Los errores internos de PDFBox se normalizan; no exponer stack traces, rutas o contenido del documento en la interfaz.

## 10. Seguridad de firma y distribución

Este bloque es P0 y se realiza antes de cualquier release distribuido:

- Revocar/rotar los secretos de firma actualmente expuestos.
- Retirar keystores y credenciales del control de versiones, incluido el historial donde sea posible mediante el proceso aprobado por el repositorio.
- Guardar material de firma en almacén de secretos de CI y/o almacenamiento seguro del equipo de release; inyectarlo durante el build mediante variables de entorno o archivo local no versionado.
- Añadir `.gitignore`, plantilla de propiedades sin secretos y validación CI que falle si detecta keystores, contraseñas de signing o archivos `.jks`/`.keystore` fuera de rutas aprobadas.
- Confirmar con Google Play la continuidad de la clave de upload antes de rotarla.
- Sustituir `versionName` descriptivo por una versión semántica trazable de release.

## 11. UX y copy

### Flujo de resultados

1. La persona revisa orden o plan de split.
2. PMAS muestra el total de archivos y rangos que se crearán.
3. Si se detectan limitaciones de fidelidad, aparece revisión de warnings con continuar explícito.
4. PMAS procesa y publica de manera local.
5. Éxito muestra archivos reales con acciones Abrir, Compartir y Ver en Mis PDF.

### Copy obligatorio

- “Máximo de páginas por PDF”, nunca “tamaño máximo” ni “MB” para este método.
- “Procesado en tu dispositivo. Tus documentos no se suben para unirlos o dividirlos.”
- “Se crearán archivos PDF nuevos. Los originales no se modifican.”
- “Abrir con una app compatible” cuando se lance el intent nativo.
- “Borrar este PDF de tu dispositivo” en la confirmación de eliminación.

### Localización

- Actualizar las 13 traducciones soportadas para todas las claves modificadas.
- Eliminar valores en inglés que aparecen en locales no ingleses, incluidos labels de métodos, portada y marcadores.
- La revisión de i18n bloquea release si hay clave faltante, texto de fallback involuntario o mojibake.

## 12. Criterios de aceptación

### Split determinista

- Con un PDF de 53 páginas y máximo 20, se crean partes 1–20, 21–40 y 41–53.
- Ninguna parte contiene más de 20 páginas de origen.
- Con portada, cada parte tiene una página adicional y se conserva el límite de 20 páginas de origen.
- Ninguna pantalla o ficha de PMAS presenta este método como límite MB.

### Biblioteca y acciones de archivo

- Un resultado creado aparece en “Mis PDF” al refrescar desde MediaStore.
- Tras borrar datos de la app o reinstalar, los resultados existentes en la carpeta PMAS vuelven a aparecer.
- Renombrar cambia `DISPLAY_NAME` del archivo real y sigue permitiendo abrir y compartir.
- Borrar elimina el archivo real; al refrescar ya no aparece ni en PMAS ni en la carpeta Documents.
- Open lanza un intent compatible con la URI local.
- Share adjunta el PDF como archivo, no como texto o enlace.
- La biblioteca funciona sin red y no necesita sesión, cuenta ni base de datos remota.

### Fidelidad

- Un PDF con firma muestra warning antes de publicar y el usuario debe confirmar para continuar.
- Un PDF con AcroForm muestra warning antes de publicar.
- Los warnings se muestran una vez por tipo y no bloquean archivos ordinarios.
- Los merges grandes respetan la opción de documentos/marcadores elegida o muestran una limitación específica antes de publicar.

### Rendimiento y resiliencia

- Operaciones con archivos grandes no hacen crecer la memoria de proceso de forma proporcional al tamaño total de entradas; la ruta usa scratch disk y concurrencia acotada.
- Una simulación de espacio insuficiente no deja archivos visibles ni entradas de biblioteca fantasma.
- Cancelar durante importación, merge o split libera scratch y no modifica los archivos fuente.
- La lista de biblioteca permanece interactiva mientras las miniaturas se generan en segundo plano.

### Privacidad

- Instrumentación de red confirma cero solicitudes salientes durante importación, análisis, merge, split, generación de miniatura, open, share, rename y delete.
- Ningún log de producción contiene nombre, URI, metadatos o contenido de un documento.

## 13. Plan de implementación

### Fase 0 — Contención de release (P0)

- Rotar y sacar secretos de firma.
- Corregir versión de release y pipeline de signing.
- Congelar publicaciones mientras el material de firma esté expuesto.

### Fase 1 — Contrato de producto y UI (P1)

- Reemplazar “maximum file size” por máximo de páginas en dominio, planner, UI, i18n, tests y ficha.
- Añadir revisión y presentación de warnings de fidelidad.
- Actualizar copy de privacidad y de resultados.

### Fase 2 — Biblioteca MediaStore (P1)

- Implementar APIs nativas por URI para listar, abrir, compartir, renombrar y borrar.
- Sustituir `PdfLibraryService` basado en `localStorage` por repositorio MediaStore en Android.
- Mantener un adaptador de desarrollo web explícitamente separado, sin anunciar la misma garantía de Android.

### Fase 3 — Motor de grandes documentos (P1)

- Implementar `BookmarkManifest` y merge secuencial con scratch disk para cualquier tamaño.
- Eliminar la divergencia funcional actual de merges grandes.
- Añadir preflight de espacio, cancelación transaccional y métricas locales de memoria solo para pruebas.

### Fase 4 — Calidad y release (P2)

- Miniaturas diferidas con LRU local.
- Pruebas de dispositivo físico, pruebas de reinstalación y pruebas de PDFs grandes.
- Validación completa de localización y Play Store assets.

## 14. Pruebas requeridas

- Unitarias TypeScript: planner por máximo de páginas, rangos, portada y validaciones.
- Unitarias Java: manifest de marcadores, MediaStore por URI, rollback y saneamiento de nombres.
- Instrumentadas Android: creación, lista, open intent, share intent, rename, delete, reinstalación y falta de espacio.
- Integración de PDFs: normal, muchas páginas, imágenes pesadas, marcadores anidados, AcroForm, firma, etiquetas de página, enlaces internos, cifrado y corrupto.
- Stress físico: conjunto que supere 256 MiB, operación cerca del límite de almacenamiento y cancelación en cada fase.
- Validación de privacidad: proxy/inspector de red en modo release verificando que el plano PDF no emite tráfico.
- Validación final: lint, tests, build web, `assembleDebug`, `bundleRelease` y prueba manual en Android.

## 15. Dependencias y decisiones pendientes

| Decisión | Responsable | Bloquea |
| --- | --- | --- |
| Rotación y custodia de clave de upload/release | Release owner | Cualquier publicación |
| Confirmar versión mínima Android de soporte | Producto/Android | Matriz de intents y MediaStore |
| Definir límite de cache de miniaturas por dispositivo | Producto/Android | Fase 4 |
| Aprobar copy legal de privacidad local | Producto/legal | Ficha y pantalla de privacidad |

## 16. Métricas de éxito

- 100% de resultados visibles en “Mis PDF” provienen de MediaStore local.
- 0 acciones exitosas de rename/delete que solo alteren UI sin modificar el archivo real.
- 0 referencias a MB para el método de máximo de páginas en UI, i18n y fichas.
- 0 OOM reproducibles en la matriz de stress aprobada.
- 0 resultados parciales visibles después de fallo o cancelación.
- 100% de PDFs con firma, formulario, etiquetas o enlace afectado muestran warning antes de publicar.

## 17. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| PDFs con objetos complejos | Validar salida, advertir limitaciones y conservar el original |
| OOM en merge grande | Merge secuencial, scratch disk, una fuente activa y sin buffers completos |
| Falta de espacio a mitad de flujo | Preflight conservador, MediaStore pendiente y rollback |
| URI inválida o externa | Validar ownership, MIME y carpeta antes de cualquier acción destructiva |
| Miniaturas lentas | Cola de una tarea, cache LRU, placeholder inmediato |
| Exposición de claves | Rotación, secretos fuera de git y control CI |
| Copy desalineado | Checklist único de UI + i18n + ficha antes de release |

## 18. Definición de terminado

El release queda terminado solo cuando:

- La firma de Android no depende de secretos versionados.
- PMAS lee y escribe todos los PDF del flujo de producto localmente.
- “Mis PDF” opera sobre archivos MediaStore reales por URI.
- Abrir, compartir, renombrar y borrar funcionan en dispositivo físico y afectan el archivo real.
- Máximo de páginas es determinista y coherente en código, UI, traducciones y Play Store.
- Las advertencias de fidelidad llegan a la persona antes de publicar.
- El merge grande conserva la semántica de marcadores elegida o advierte de forma explícita.
- La matriz de archivos grandes, espacio insuficiente, cancelación y reinstalación pasa sin OOM ni resultados parciales.
