# CCFK utility

## Project identity
- app: cover-creator-for-kindle
- alias: ccfk
- currentVersionCode: 41
- nextVersionCode: 41
- currentVersionName: "Kindle Rebranding"
- nextVersionName: "Kindle Rebranding"

## Product purpose
- Convert images into e-reader covers with model-safe output.
- Reduce incompatibility issues across device models and resolutions.
- Keep a short flow: choose model, adjust, preview, export, share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- Catalogo multi-dispositivo con resolucion real | Permite crear portadas para multiples familias de e-reader sin ajuste manual. Actualmente: 5 marcas, 19 grupos y 29 modelos. | apps/cover-creator-for-kindle/src/assets/data/kindle-model-groups.json
- Seleccion inteligente de modelo y fallback seguro | Resuelve modelo/brand por defecto y evita selecciones invalidas. | apps/cover-creator-for-kindle/src/app/services/kindle-catalog.service.ts
- Validacion fuerte de imagen de entrada | Detecta tipo no soportado, tamano fuera de limite y archivos corruptos antes de exportar. | apps/cover-creator-for-kindle/src/app/services/image-pipeline.service.ts
- Previsualizacion antes de guardar/compartir | Permite validar el resultado final de portada sin salir del flujo de edicion. | apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts
- Reduccion de artefactos y metadatos de dithering | Mejora legibilidad en pantallas e-ink y conserva informacion de procesamiento por portada. | apps/cover-creator-for-kindle/src/app/services/file.service.ts
- Calidad de exportacion configurable | Balancea calidad visual y tamano de archivo segun preferencia del usuario. | apps/cover-creator-for-kindle/src/app/settings/ccfk-settings.schema.ts
- Guardado y compartido de EPUB generado | Permite flujo completo desde edicion hasta envio a app/servicio de lectura. | apps/cover-creator-for-kindle/src/app/services/file.service.ts
- Persistencia de preferencias y hints de onboarding | Recuerda modelo y opciones de exportacion para reducir friccion en usos repetidos. | apps/cover-creator-for-kindle/src/app/settings/ccfk-settings.schema.ts

## Differentiators (facts)
- Model-aware output workflow for e-readers.
- Integrated preview before save/share.
- Artifact reduction oriented to e-ink readability.

## Valid additional use cases (facts)
- Personal placeholders for books read in physical format.
- Uniform library thumbnails by collection/author/series.
- High-contrast variants for readability workflows.

## User-facing change facts (increment)
- appTitleLocalesUpdated: 0
- androidAppNameKeysUpdated: 0

## Increment scope facts
- deltaFrom: 9fd1a17310a22565cbf7a07a4c55688f93e27ca1
- deltaTo: 1cf564b7546dfb08997df73c6e9037396c197274
- changedFiles: 13
- apps/cover-creator-for-kindle/android/app/src/main/res/values/strings.xml
- apps/cover-creator-for-kindle/src/assets/i18n/ar-SA.json
- apps/cover-creator-for-kindle/src/assets/i18n/de-DE.json
- apps/cover-creator-for-kindle/src/assets/i18n/es-MX.json
- apps/cover-creator-for-kindle/src/assets/i18n/fr-FR.json
- apps/cover-creator-for-kindle/src/assets/i18n/it-IT.json
- apps/cover-creator-for-kindle/src/assets/i18n/ja-JP.json
- apps/cover-creator-for-kindle/src/assets/i18n/ko-KR.json
- apps/cover-creator-for-kindle/src/assets/i18n/pt-BR.json
- apps/cover-creator-for-kindle/src/assets/i18n/ru-RU.json
- apps/cover-creator-for-kindle/src/assets/i18n/zh-CN.json
- apps/cover-creator-for-kindle/src/assets/i18n/zh-TW.json
- M apps/cover-creator-for-kindle/android/app/build.gradle

## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW

## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Any claim must map to evidence path above.

## Tracking
- versionCodeAnchorCommit: 9fd1a17310a22565cbf7a07a4c55688f93e27ca1
- generatedAt: 2026-05-20T01:21:06.059Z
