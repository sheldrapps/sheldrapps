# ECC utility
## Project identity
- app: epub-cover-changer
- alias: ecc
- currentVersionCode: 41
- nextVersionCode: 42
- currentVersionName: "Scratch source and UX parity"
- nextVersionName: "Manual optimize and i18n fix"
## Product purpose
- Keep fast local cover workflow with clear source-to-output path.
- Preserve model-aware crop behavior and trustworthy preview.
- Reduce accidental quality loss by making optimization explicit and manual.
## Capability inventory (facts)
- format: capability | user-value | evidence
- e-reader optimization preference removed from settings | No hidden persisted auto-optimize state between sessions. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- e-reader optimization now manual-only in editor tools | User decides when optimization runs, case by case. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- Source labels localized for all supported locales | Better readability in source actions across locales. | packages/image-workflow/src/lib/cover-source/i18n/cover-source.translations.ts
- Source actions remain centralized in shared kit | Consistent Image/Scratch wording across apps. | packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.html
## User-facing change facts (increment)
- Removed settings-level optimization toggle and persisted preference path.
- Optimization now applies only when manually used inside editor tools.
- Updated source-action labels across supported locales.
## Increment scope facts
- deltaFrom: 346e0b6d22d07b395c60014d440b768620e484ed
- deltaTo: 9c7a4b2b1c48525c799f78df23eae3d421dcc892
- changedFiles: 41
- apps/epub-cover-changer/src/app/pages/settings/settings.page.html
- apps/epub-cover-changer/src/app/pages/change/change.page.ts
- packages/image-workflow/src/lib/cover-source/i18n/cover-source.translations.ts
- packages/image-workflow/src/lib/components/cover-source-actions/cover-source-actions.component.html
## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Claims must map to verifiable evidence paths listed above.
## Tracking
- versionCodeAnchorCommit: 9c7a4b2b1c48525c799f78df23eae3d421dcc892
- generatedAt: 2026-05-29T04:13:13.6600632Z
