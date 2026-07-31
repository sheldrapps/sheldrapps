# Auditoría temporal de flujo EPUB (ECC)

Fecha: 2026-05-23
Alcance: `apps/epub-cover-changer` únicamente. Enfoque exclusivo en manejo de archivos EPUB (validación, lectura/escritura, estructura, rename, persistencia, compartido, migraciones y errores). Se excluye deliberadamente edición de imagen y flujo UI no relacionado con archivos EPUB.

## 1) Componentes auditados

- `src/app/services/file.service.ts`
- `src/app/services/epub-rewrite.service.ts`
- `src/app/services/epub-working-copy.service.ts`
- `src/app/services/epub-candidate-image.service.ts` (solo la parte EPUB: inspección interna de zip/manifiesto para cobertura)
- `packages/file-kit/src/lib/file-kit.service.ts`
- `packages/file-kit/src/lib/epub-public-store.ts`
- `packages/file-kit/src/lib/web-epub-cover.service.ts`
- `src/app/pages/change/change.page.ts` (solo integración de casos EPUB y mapeo de errores)

## 2) Flujo EPUB real (resumen técnico)

### 2.1 Ingreso y validación inicial

1. Selección de archivo EPUB:
   - Web: `onEpubSelected(...)`.
   - Android nativo: `pickNativeEpub(...)`.

2. Validación primaria por contrato de `file-kit`:
   - `validateEpub(file, maxSizeMB)` valida:
     - archivo presente,
     - extensión `.epub`,
     - MIME permitido o vacío,
     - tamaño <= límite,
     - tamaño > 0.

3. Copia de trabajo:
   - Web/Data: `EpubWorkingCopyService.startCycle(...)` crea working copy con nombre saneado + timestamp + colisiones ` (n)`.
   - Nativo plugin: `EpubRewrite.pickAndPrepareEpub(...)` devuelve rutas working + metadatos + cover opcional.

4. Validación estructural:
   - Nativo: `inspectEpub(...)` sobre copia temporal.
   - Web fallback: `webEpubCover.isReadableEpub(...)` comprueba `META-INF/container.xml`.

### 2.2 Lectura de cover interna del EPUB

- Ruta estricta (metadata cover): `resolveStrictCover(...)` intenta hallar cover en OPF (`properties=cover-image`, meta cover, ids convencionales).
- Si no hay match estricto, el flujo cae a descubrimiento de candidatos internos del zip (manifest + recorrido zip) para fallback de portada.

### 2.3 Reescritura / generación EPUB

- Reescritura desde EPUB origen:
  - Web: `webEpubCover.replaceCover(...)` (JSZip).
  - Nativo: `inspectEpub(...)` + `rewriteCover(...)`.
- Generación EPUB mínimo desde cover:
  - Web: `webEpubCover.createMinimalEpub(...)`.
  - Nativo: `createEpubFromCover(...)`.

### 2.4 Persistencia, nombrado y share

- Persistencia principal:
  - Android: `EpubPublicStore` en rutas públicas de Documents (`/storage/.../Documents/<folder>`), con migración desde carpeta Documents legacy.
  - Web/no nativo: escritura en `Documents/<EPUB_FOLDER>`.
- Nombrado:
  - `ensureEpubExt(...)`, `sanitizeFilename(...)`, `getUniqueDocumentFilename(...)`.
- Operaciones:
  - save (`saveGeneratedEpub*`), rename (`renameGeneratedEpub`), delete (`deleteCoverByFilename`), share (`shareGeneratedEpub*`, `shareCoverByFilename`).

## 3) Validaciones y casos EPUB detectados

### 3.1 Validación de tipo/tamaño/archivo vacío

Implementación en `file-kit`:
- `EPUB_ERROR_NO_FILE`
- `EPUB_ERROR_TYPE`
- `EPUB_ERROR_SIZE`
- `EPUB_ERROR_CORRUPT` (size 0)

### 3.2 Validación estructural EPUB

- Resultado booleano (`true/false`) en `validateEpubStructure(...)`.
- En error estructural, el flujo de UI trata como `EPUB_ERROR_CORRUPT`.

### 3.3 Casos nativos mapeados

Desde `EpubRewriteError.code`:
- `EPUB_TOO_LARGE` -> `EPUB_ERROR_SIZE`
- `NO_SPACE` -> `EPUB_ERROR_STORAGE` (con `requiredMB` y `availableMB`)
- `NO_COVER` -> `EPUB_ERROR_NO_COVER`
- fallback -> `EPUB_ERROR_CORRUPT`

En reescritura nativa:
- `NO_COVER` / `COVER_NOT_FOUND` -> toast `EPUB_ERROR_NO_COVER`
- `NO_SPACE` -> toast `EPUB_ERROR_STORAGE`
- otros -> `EPUB_ERROR_REWRITE`
- `CANCELLED` / `PICK_CANCELLED` se manejan como cancelación no-fatal.

### 3.4 Casos internos del zip al buscar cover/candidatos

Se rechazan imágenes internas por:
- entrada faltante en zip,
- MIME no soportado,
- imagen ilegible,
- path vacío.

Además, cover estricto ignora `image/svg+xml` para selección estricta.

### 3.5 Migraciones y compatibilidad de almacenamiento

- Migración automática de EPUBs de carpetas legacy (`CoverCreator`) hacia carpeta pública activa.
- `EpubPublicStore` intenta múltiples roots públicos (`/storage/emulated/0/Documents`, `/storage/self/primary/Documents`, `/sdcard/Documents`) y fallback por `Directory.Documents`.
- Existe limpieza best-effort de residuos en Cache y de ubicación legacy Documents tras writes/rename/delete.

## 4) Riesgos / hallazgos técnicos (solo EPUB)

1. **Cobertura de tests muy limitada para flujo EPUB**
   - Solo hay test directo relevante de `saveGeneratedEpub`.
   - No hay pruebas unitarias explícitas para validación estructural, migración de carpetas legacy, rename con colisiones, mapeo de errores nativos, ni `generateEpubBytesFromSource`.

2. **Código de error potencialmente no visible en i18n**
   - `validateEpub(...)` puede retornar `EPUB_ERROR_NO_FILE`, pero no aparece en `en-US.json` actual. En la práctica casi no se activa por el gate de input, pero el contrato existe.

3. **Dependencia no auditable aquí: plugin nativo**
   - El repositorio registra `EpubRewritePlugin` en `MainActivity`, pero no incluye su implementación Java/Kotlin en árbol auditado.
   - Se audita únicamente la capa TypeScript y el mapeo de errores, no la lógica interna nativa.

## 5) Inventario de operaciones EPUB por servicio

### `FileService`
- Validar: `validateEpub`, `validateEpubStructure`
- Extraer cover del EPUB: `extractCoverFromEpubFile`
- Generar/reescribir bytes EPUB: `generateEpubBytes`, `generateEpubBytesFromSource`
- Guardar EPUB: `saveGeneratedEpub`, `saveGeneratedEpubFromPath`, `saveGeneratedEpubFromExistingDocument`
- Gestión nombres/colisiones: `ensureEpubExt`, `sanitizeFilename`, `getUniqueDocumentFilename`
- Gestión de archivos finales: `listCovers`, `hasCoverByFilename`, `renameGeneratedEpub`, `deleteGeneratedEpub`, `shareGeneratedEpub*`
- Migraciones almacenamiento: `ensurePublicDocumentsEpubFolderReady`, `migrateLegacyEpubFoldersOnce`

### `EpubRewriteService`
- Gate de soporte Android/plugin
- `pickAndPrepareEpub`, `inspectEpub`, `rewriteCover`, `createEpubFromCover`, `extractCoverAsset`
- Estandarización de errores mediante `EpubRewriteError`

### `EpubWorkingCopyService`
- Copia de trabajo saneada y única en `Data`
- Limpieza best-effort de working files

### `EpubCandidateImageService`
- Lectura bytes del EPUB (File o native path)
- Parse de zip/OPF para cover estricto y candidatos internos
- Filtros de MIME legible y dimensiones

## 6) Estado actual del flujo EPUB (conclusión)

- El flujo EPUB en ECC es robusto en **validación básica**, **estructura**, **persistencia con rutas públicas**, **manejo de colisiones de nombres**, **errores de storage** y **fallback web/nativo**.
- El mayor riesgo actual no es funcional inmediato, sino de **mantenibilidad/aseguramiento** por baja cobertura de pruebas en escenarios EPUB críticos.

## 7) Recomendaciones inmediatas (temporales)

1. Añadir tests unitarios para:
   - `validateEpubStructure` (web y nativo mock).
   - `generateEpubBytesFromSource` con casos `NO_COVER` y `REWRITE_FAILED`.
   - `renameGeneratedEpub` con colisión y faltantes.
   - `migrateLegacyEpubFoldersOnce` (migrado/duplicado/fallo).

2. Confirmar si se desea soportar `EPUB_ERROR_NO_FILE` en i18n (o eliminarlo del contrato de retorno si no se usará).

3. Documentar oficialmente los códigos esperados de `EpubRewritePlugin` en un contrato compartido (TS + plugin nativo) para evitar desalineación futura.
