# PCM utility
## Project identity
- app: pdf-cover-maker
- alias: pcm
- currentVersionCode: 5
- nextVersionCode: 6
- currentVersionName: "Ad fallback trial flow"
- nextVersionName: "Fallback tour cohesion"
## Product purpose
- Keep cover generation dependable when ads fail unexpectedly.
- Preserve explicit user consent before using fallback trial exports.
- Keep onboarding behavior coherent across home, editor, and remove-ads tour steps.
## Capability inventory (facts)
- format: capability | user-value | evidence
- ad failure now opens fallback offer flow | User can continue generation with trial export when rewarded ad fails to load. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- fallback trial only consumes on successful output | Trial attempts are spent only after successful generate/save paths, not on failed processing. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- blocking fallback modal now dismisses active tour overlay | Prevents tour overlay from masking fallback confirmation modal. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- skipping home tour now marks editor-tour as seen | Home/editor/remove-ads onboarding behaves as one unified flow when omitted. | apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- ad fallback modal remains non-dismissible except accepted role | Enforces explicit acknowledgement before continuing trial export. | packages/ad-fallback-kit/src/lib/ad-fallback.service.ts
## User-facing change facts (increment)
- Fallback trial flow now appears reliably when rewarded ads fail.
- Trial export consumption remains tied to successful generation/save only.
- Tour overlay no longer competes with fallback modal, and skip behavior is unified.
## Increment scope facts
- deltaFrom: 9c7a4b2b1c48525c799f78df23eae3d421dcc892
- deltaTo: b4a177404511d6b3cf1065b1ebb24609d69a7756
- changedFiles: 9
- apps/pdf-cover-maker/android/app/build.gradle
- apps/pdf-cover-maker/src/app/pages/change/change.page.ts
- apps/pdf-cover-maker/src/main.ts
- apps/pdf-cover-maker/tsconfig.json
- apps/pdf-cover-maker/tsconfig.app.json
- packages/ad-fallback-kit/src/lib/ad-fallback.service.ts
- packages/ad-fallback-kit/src/lib/ad-fallback-modal/ad-fallback-modal.component.ts
- packages/ad-fallback-kit/src/lib/ad-fallback-modal/ad-fallback-modal.component.scss
- packages/ads-kit/src/lib/ads.service.ts
## Locale coverage facts
- localeCount: 13
- localeList: ar-SA, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual input for ficha generation; it is not final store copy.
- Claims must map to verifiable evidence paths listed above.
## Tracking
- versionCodeAnchorCommit: b4a177404511d6b3cf1065b1ebb24609d69a7756
- generatedAt: 2026-06-01T04:30:16.941Z
