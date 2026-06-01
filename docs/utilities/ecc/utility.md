# ECC utility
## Project identity
- app: epub-cover-changer
- alias: ecc
- currentVersionCode: 42
- nextVersionCode: 43
- currentVersionName: "Manual optimize and i18n fix"
- nextVersionName: "Fallback tour cohesion"
## Product purpose
- Keep cover generation dependable when ads fail unexpectedly.
- Preserve explicit user consent before using fallback trial exports.
- Keep onboarding behavior coherent across home, editor, and remove-ads tour steps.
## Capability inventory (facts)
- format: capability | user-value | evidence
- ad failure now opens fallback offer flow | User can continue generation with trial export when rewarded ad fails to load. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- fallback trial only consumes on successful output | Trial attempts are spent only after successful generate/save paths, not on failed processing. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- blocking fallback modal now dismisses active tour overlay | Prevents tour overlay from masking fallback confirmation modal. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- skipping home tour now marks editor-tour as seen | Home/editor/remove-ads onboarding behaves as one unified flow when omitted. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- ad fallback modal remains non-dismissible except accepted role | Enforces explicit acknowledgement before continuing trial export. | packages/ad-fallback-kit/src/lib/ad-fallback.service.ts
## User-facing change facts (increment)
- Fallback trial flow now appears reliably when rewarded ads fail.
- Trial export consumption remains tied to successful generation/save only.
- Tour overlay no longer competes with fallback modal, and skip behavior is unified.
## Increment scope facts
- deltaFrom: 9c7a4b2b1c48525c799f78df23eae3d421dcc892
- deltaTo: b4a177404511d6b3cf1065b1ebb24609d69a7756
- changedFiles: 6
- apps/epub-cover-changer/android/app/build.gradle
- apps/epub-cover-changer/src/app/pages/change/change.page.ts
- apps/epub-cover-changer/src/app/pages/settings/settings.page.html
- apps/epub-cover-changer/src/app/pages/settings/settings.page.ts
- packages/covers-list-kit/src/cover-list-content.component.scss
- packages/image-workflow/src/lib/cover-source/i18n/cover-source.translations.ts
## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual release traceability data, not marketing copy.
- Keep behavior aligned with free tier plus ad fallback trial contract.
- Do not spend trial exports on failed generate/save attempts.
