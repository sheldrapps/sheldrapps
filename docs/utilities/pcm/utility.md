# PCM utility

## Project identity
- app: pdf-cover-maker
- alias: pcm
- currentVersionCode: 2
- nextVersionCode: 3
- currentVersionName: "Native pick and PDF stability"
- nextVersionName: "Scratch flow and crop parity"

## Product purpose
- Create cleaner PDF first-page covers with a guided, local workflow.
- Help users improve visual organization of PDF libraries without cloud upload.
- Keep a short loop: pick PDF, pick source, adjust, export, save/share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- New source switch image or scratch | User can start cover design from blank background after PDF is selected. | apps/pdf-cover-maker/src/app/pages/change/change.page.html
- Scratch start wired to editor tools entry | Scratch path opens tools-first editor and jumps to background setup. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- Best candidate hides after done from image/scratch | Candidate helper is removed once user commits source in editor. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- Scratch guardrails in fill panel | Same-image action remains disabled and eyedropper unlocks only after color exists. | packages/image-workflow/src/lib/editor/panels/tools/widgets/fill-panel.component.ts
- Detected PDF crop and editor/export crop aligned | Editor preview and exported output now follow same crop interpretation. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- Thumbnail preview frame removed | Thumbnail now reflects real crop ratio with no decorative frame bars. | apps/pdf-cover-maker/src/app/pages/change/change.page.html
- Tour flow updated for source chooser path | Tour includes source actions and preserves one-time behavior unless manual relaunch. | apps/pdf-cover-maker/src/app/shared/tour/home-tour.definition.ts
- Shared source actions extracted to kit | Image/scratch controls and translations reused across all apps. | packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.ts

## Differentiators (facts)
- Native-first PDF ingest path tuned for Android document providers.
- Scratch-first and image-first cover entry in same flow.
- Crop parity between editor view and exported file.
- Local-first file flow focused on privacy and fast execution.

## Valid additional use cases (facts)
- Make training PDFs easier to identify by topic with custom visual covers.
- Build color-first minimal covers directly from scratch mode.
- Prepare clean before/after cover variants with predictable crop output.

## User-facing change facts (increment)
- Added source picker with sibling actions: image and scratch.
- Scratch opens editor directly on background tool path.
- After done from image or scratch, best candidate helper hides again.
- In scratch mode, same-image is disabled and eyedropper unlocks only after color selection.
- PDF detected crop and editor/export crop logic now align, preventing mismatched heavy crop on export.
- Thumbnail preview no longer uses frame and now reflects real crop ratio.
- Tour updated for new inputs and auto-run remains one-time unless manually relaunched.

## Increment scope facts
- deltaFrom: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- deltaTo: 346e0b6d22d07b395c60014d440b768620e484ed
- changedFiles: 50
- apps/pdf-cover-maker/src/app/pages/change/change.page.html
- apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- apps/pdf-cover-maker/src/app/shared/tour/home-tour.definition.ts
- apps/pdf-cover-maker/src/assets/i18n/en-US.json
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
- This increment does not claim PDF editing, merge, split, OCR, or compression.

## Tracking
- versionCodeAnchorCommit: 346e0b6d22d07b395c60014d440b768620e484ed
- generatedAt: 2026-05-28T03:46:35.8762772Z
