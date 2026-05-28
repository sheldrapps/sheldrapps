# PCM utility

## Project identity
- app: pdf-cover-maker
- alias: pcm
- currentVersionCode: 1
- nextVersionCode: 2
- currentVersionName: "Guided tour and brand refresh"
- nextVersionName: "Native pick and PDF stability"

## Product purpose
- Create cleaner PDF first-page covers with a guided, local workflow.
- Help users improve visual organization of PDF libraries without cloud upload.
- Keep a short loop: pick PDF, pick image, adjust, export, save/share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- Android PDF selection now prefers native plugin picker whenever plugin is available | Avoids fragile web file input path with streamed SAF providers on low/mid devices. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- Native picker gate decoupled from native rewrite gate | PDF import remains stable even when rewrite safety gate is disabled for session or SDK. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- PDFBox resources are explicitly initialized before PDF operations | Prevents glyph list initialization crash during first-page preview rendering. | plugins/pdf-rewrite/android/src/main/java/com/sheldrapps/plugins/pdfrewrite/PdfRewritePlugin.java
- Plugin worker threads now catch fatal throwables in pick/inspect/rewrite/create/preview | Reduces process-kill risk from runtime initializer errors and returns controlled plugin errors. | plugins/pdf-rewrite/android/src/main/java/com/sheldrapps/plugins/pdfrewrite/PdfRewritePlugin.java
- Recommended-apps ECC icon mapping fixed in PCM asset pipeline | Users now see ECC icon correctly instead of PCM icon in recommendations panel. | apps/pdf-cover-maker/angular.json
- Production build excludes web PDF worker assets for Android release | Removes unneeded web worker payload in release package when web adapters are disabled. | apps/pdf-cover-maker/angular.json
- PDF file-kit provider now enables web adapters only when explicitly requested | Keeps web fallback behavior in dev/web while excluding it in production Android. | packages/file-kit/src/lib/providers-pdf.ts

## Differentiators (facts)
- Native-first PDF ingest path tuned for Android document providers.
- Defensive native rendering path against PDFBox resource init failures.
- Local-first file flow focused on privacy and fast execution.

## Valid additional use cases (facts)
- Make training PDFs easier to identify by topic with custom visual covers.
- Standardize document collections for teams sharing many similar PDFs.
- Prepare clean before/after cover variants for study or archive workflows.

## User-facing change facts (increment)
- PDF picker in Android now routes through native plugin path to avoid file-handle drop after streamed picker selection.
- Native PDF import remains available even when rewrite safety gate blocks native rewrite stage.
- Crash class around missing PDFBox glyph resources is mitigated by explicit resource loader init.
- Native plugin preview/rewrite workers now return controlled failures for fatal runtime initialization errors.
- Recommended apps in PCM now show ECC icon correctly.
- Android release excludes web PDF worker artifacts.

## Increment scope facts
- deltaFrom: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- deltaTo: WORKTREE
- changedFiles: 22
- M apps/pdf-cover-maker/android/app/build.gradle
- apps/pdf-cover-maker/android/app/src/main/AndroidManifest.xml
- apps/pdf-cover-maker/capacitor.config.ts
- apps/pdf-cover-maker/ionic.config.json
- apps/pdf-cover-maker/ios/App/App/Info.plist
- apps/pdf-cover-maker/package.json
- apps/pdf-cover-maker/src/app/pages/change/change.page.html
- apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- apps/pdf-cover-maker/src/app/pages/settings/settings.page.ts
- apps/pdf-cover-maker/src/app/services/ads.config.ts
- apps/pdf-cover-maker/src/app/shared/tour/home-tour.definition.ts
- apps/pdf-cover-maker/src/app/shared/tour/tour-overlay.component.ts
- apps/pdf-cover-maker/src/app/shared/tour/tour.service.ts
- apps/pdf-cover-maker/src/assets/i18n/en-US.json
- apps/pdf-cover-maker/src/assets/i18n/es-MX.json
- apps/pdf-cover-maker/src/main.ts
- packages/file-kit/src/lib/providers-pdf.ts
- packages/file-kit/src/lib/providers.ts
- packages/file-kit/src/public-api.ts
- plugins/pdf-rewrite/android/src/main/java/com/sheldrapps/plugins/pdfrewrite/PdfRewritePlugin.java
- apps/pdf-cover-maker/resources/icon_512.png

## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW

## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Claims must map to verifiable evidence paths listed above.
- This increment does not claim PDF editing, merge, split, OCR, or compression.

## Tracking
- versionCodeAnchorCommit: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- generatedAt: 2026-05-27T15:11:01.1046198-06:00
