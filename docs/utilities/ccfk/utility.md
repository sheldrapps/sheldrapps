# CCFK utility

## Project identity
- app: cover-creator-for-kindle
- alias: ccfk
- currentVersionCode: 41
- nextVersionCode: 42
- currentVersionName: "Kindle Rebranding"
- nextVersionName: "Scratch source and tour reset"

## Product purpose
- Convert images into e-reader covers with model-safe output.
- Reduce incompatibility issues across device models and resolutions.
- Keep short flow: choose source, adjust, preview, export, share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- New source switch image or scratch | User can start from blank canvas without importing image first. | apps/cover-creator-for-kindle/src/app/pages/create/create.page.html
- Scratch opens editor directly in tools/fill path | Faster zero-to-cover flow with no extra taps to reach background controls. | apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts
- Shared source actions extracted to kit | Same UX and translation keys reused across apps, reducing drift. | packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.ts
- Scratch mode wired in editor session | Editor preserves source mode and enables scratch-specific behavior. | packages/image-workflow/src/lib/editor/editor-session.service.ts
- Fill panel behavior adjusted for scratch mode | Same-image action stays disabled, eyedropper gated by color selection in scratch. | packages/image-workflow/src/lib/editor/panels/tools/widgets/fill-panel.component.ts
- Home and editor tours updated for new source inputs | Guidance includes source chooser and keeps manual guide re-entry path. | apps/cover-creator-for-kindle/src/app/shared/tour/home-tour.definition.ts
- Thumbnail preview frame removed | Miniature now reflects crop ratio directly without misleading outer frame. | apps/cover-creator-for-kindle/src/app/pages/create/create.page.html
- 13-locale copy update for new source labels | Image and scratch labels shipped across supported locales. | apps/cover-creator-for-kindle/src/assets/i18n/en-US.json

## Differentiators (facts)
- Model-aware output workflow for e-readers.
- New blank-canvas entry point in same main flow.
- Preview and editor behavior aligned with final crop ratio.

## Valid additional use cases (facts)
- Build simple text or color-first covers without base image.
- Prototype quick variants with scratch background before importing art.
- Keep consistent cover composition across series using same blank start.

## User-facing change facts (increment)
- Added source picker with sibling actions: image and scratch.
- Scratch opens editor on tools flow so user starts directly on background setup.
- Preview thumbnail now shows real crop ratio without framing bars.
- Tour definitions updated for new input path and manual guide replay.

## Increment scope facts
- deltaFrom: 1cf564b7546dfb08997df73c6e9037396c197274
- deltaTo: 346e0b6d22d07b395c60014d440b768620e484ed
- changedFiles: 62
- apps/cover-creator-for-kindle/src/app/pages/create/create.page.html
- apps/cover-creator-for-kindle/src/app/pages/create/create.page.ts
- apps/cover-creator-for-kindle/src/app/shared/tour/home-tour.definition.ts
- apps/cover-creator-for-kindle/src/assets/i18n/en-US.json
- packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.ts
- packages/image-workflow/src/lib/cover-source/i18n/cover-source.translations.ts
- packages/image-workflow/src/lib/editor/editor-session.service.ts
- packages/image-workflow/src/lib/editor/editor-shell.page.ts
- packages/image-workflow/src/lib/editor/panels/tools/widgets/fill-panel.component.ts

## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW

## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Claims must map to verifiable evidence paths listed above.
- This increment does not claim OCR, file conversion, or cloud sync features.

## Tracking
- versionCodeAnchorCommit: 346e0b6d22d07b395c60014d440b768620e484ed
- generatedAt: 2026-05-28T03:46:35.8762772Z
