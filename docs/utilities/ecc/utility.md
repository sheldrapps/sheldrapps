# ECC utility

## Project identity
- app: epub-cover-changer
- alias: ecc
- currentVersionCode: 40
- nextVersionCode: 41
- currentVersionName: "Guided tour sync refresh"
- nextVersionName: "Scratch source and UX parity"

## Product purpose
- Replace or update EPUB covers with a fast, local workflow.
- Keep documents readable and visually cleaner in e-reader libraries.
- Keep the core loop simple: pick EPUB, pick source, adjust, export, save/share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- New source switch image or scratch | User can open editor with blank background flow, no input image required. | apps/epub-cover-changer/src/app/pages/change/change.page.html
- Scratch start wired to editor tools entry | Scratch mode lands on tools path and opens background setup quickly. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Best candidate hides after done from image/scratch | Candidate helper disappears when user already committed source in editor. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Scratch guardrails in fill panel | Same-image action disabled and eyedropper disabled until color exists in scratch mode. | packages/image-workflow/src/lib/editor/panels/tools/widgets/fill-panel.component.ts
- Shared source actions extracted to kit | Source controls and translations reused consistently across apps. | packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.ts
- Tour flow updated for new source inputs | Tour path covers image/scratch chooser and preserves manual guide restart flow. | apps/epub-cover-changer/src/app/shared/tour/home-tour.definition.ts
- Tour replay gating by seen version | Auto-play does not re-run after seen, unless user relaunches manually from guide/settings. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Thumbnail preview frame removed | Thumbnail now mirrors crop ratio directly and avoids false border expectation. | apps/epub-cover-changer/src/app/pages/change/change.page.html

## Differentiators (facts)
- Guided flow reacts to real UI changes rather than fixed coordinates.
- Source picker supports both image-first and scratch-first entry.
- Local-first workflow with no cloud upload requirement.

## Valid additional use cases (facts)
- Standardize old EPUB libraries with cleaner cover consistency.
- Build simple color-first covers directly from scratch mode.
- Quick repeated updates using remembered settings and tour-on-demand.

## User-facing change facts (increment)
- Added sibling source buttons: image and scratch.
- Scratch opens editor in tools flow and starts from background setup path.
- After done from image or scratch, best candidate helper hides again.
- In scratch mode, same-image stays disabled and eyedropper unlocks only after color selection.
- Thumbnail preview no longer uses frame, so crop ratio display matches expected output.
- Tour updated for new inputs and stays one-time unless manually relaunched.

## Increment scope facts
- deltaFrom: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- deltaTo: 346e0b6d22d07b395c60014d440b768620e484ed
- changedFiles: 42
- apps/epub-cover-changer/src/app/pages/change/change.page.html
- apps/epub-cover-changer/src/app/pages/change/change.page.ts
- apps/epub-cover-changer/src/app/shared/tour/home-tour.definition.ts
- apps/epub-cover-changer/src/assets/i18n/en-US.json
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
- This increment does not claim OCR, PDF editing, conversion, merge, or compression features.

## Tracking
- versionCodeAnchorCommit: 346e0b6d22d07b395c60014d440b768620e484ed
- generatedAt: 2026-05-28T03:46:35.8762772Z
