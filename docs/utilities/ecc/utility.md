# ECC utility

## Project identity
- app: epub-cover-changer
- alias: ecc
- currentVersionCode: 39
- nextVersionCode: 40
- currentVersionName: "Optimize for e-ink and sharpness"
- nextVersionName: "Guided tour sync refresh"

## Product purpose
- Replace or update EPUB covers with a fast, local workflow.
- Keep documents readable and visually cleaner in e-reader libraries.
- Keep the core loop simple: pick EPUB, pick cover image, adjust, export, save/share.

## Capability inventory (facts)
- format: capability | user-value | evidence
- Guided onboarding with interaction-aware steps | Users can follow the flow step by step without guessing the next action. | apps/epub-cover-changer/src/app/shared/tour/home-tour.definition.ts
- Dynamic tour synchronization on UI mutations and resize | Spotlight stays aligned when warnings, toggles, modals, and layout changes happen. | apps/epub-cover-changer/src/app/shared/tour/tour.service.ts
- Manual tour restart from guide entrypoint | Tapping guide now relaunches the full tour instead of only showing static help text. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Editor segment replay in manual tours | Manual tour explicitly replays the editor "Done" segment when reopened. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Remove-ads segment included in manual tours | Manual tours include CTA + close modal steps so the purchase branch is explained end to end. | apps/epub-cover-changer/src/app/shared/tour/home-tour.definition.ts
- Export quality step included in tour | Free vs paid export path is now visible during onboarding. | apps/epub-cover-changer/src/app/pages/change/change.page.html
- Tour overlay above modal layers | Tour tooltip/spotlight remains visible over overlays with higher z-index handling. | apps/epub-cover-changer/src/app/shared/tour/tour-overlay.component.ts
- Web-dev startup stability for non-PDF apps | General file-kit provider no longer pulls PDF web cover service in ECC/CCFK builds. | packages/file-kit/src/lib/providers.ts

## Differentiators (facts)
- Guided flow that reacts to real UI changes rather than fixed coordinates.
- Onboarding covers both free and paid export paths in the same walkthrough.
- Local-first workflow with no cloud upload requirement.

## Valid additional use cases (facts)
- Standardize old EPUB libraries with cleaner cover consistency.
- Prepare teaching/study EPUB sets with clearer visual identification.
- Quick batch-like repeated updates using remembered settings.

## User-facing change facts (increment)
- Tour now tracks moving UI and modal transitions more reliably.
- Guide button now launches the tour flow directly.
- Manual tour now replays editor and remove-ads segments.
- Export quality guidance was added to onboarding copy.
- Privacy policy URL for settings was normalized to sheldrapps.com.

## Increment scope facts
- deltaFrom: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- deltaTo: 5f50a1d7e2a10b7e3ec79522e0f48c0ba5b517a3
- changedFiles: 10
- apps/epub-cover-changer/src/app/pages/change/change.page.html
- apps/epub-cover-changer/src/app/pages/change/change.page.ts
- apps/epub-cover-changer/src/app/pages/settings/settings.page.ts
- apps/epub-cover-changer/src/app/shared/tour/home-tour.definition.ts
- apps/epub-cover-changer/src/app/shared/tour/tour-overlay.component.ts
- apps/epub-cover-changer/src/app/shared/tour/tour.service.ts
- apps/epub-cover-changer/src/assets/i18n/en-US.json
- apps/epub-cover-changer/src/assets/i18n/es-MX.json
- packages/file-kit/src/lib/providers.ts
- packages/file-kit/src/public-api.ts

## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW

## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Claims must map to verifiable evidence paths listed above.
- This increment does not claim OCR, PDF editing, conversion, merge, or compression features.

## Tracking
- versionCodeAnchorCommit: 9fd1a17310a22565cbf7a07a4c55688f93e27ca1
- generatedAt: 2026-05-27T06:26:08.502Z
