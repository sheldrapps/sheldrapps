# ECC utility
## Project identity
- app: epub-cover-changer
- alias: ecc
- currentVersionCode: 50
- nextVersionCode: 51
- currentVersionName: "Rewarded retry recovery"
- nextVersionName: "Rewarded retry recovery"
## Product purpose
- Keep cover generation dependable when rewarded ads recover after a failed attempt.
- Preserve explicit user consent before using fallback trial exports.
- Keep onboarding behavior coherent across home, editor, and remove-ads tour steps.
## Capability inventory (facts)
- format: capability | user-value | evidence
- preview and 3-dot actions use the shared Edit label and a scrollable action bar. | Users can reach edit actions without truncated buttons. | packages/covers-list-kit/src/cover-preview-modal.component.ts
- overwrite and copy filename resolution is centralized. | Overwrite keeps the original filename while copy mode keeps a separate copy name. | packages/image-workflow/src/lib/editor/project-save-state.ts
- ad failure now opens fallback offer flow | User can continue generation with trial export when rewarded ad fails to load. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- rewarded ads reset after a failed attempt. | Users can retry after a network or blocker change without force-closing the app. | packages/ads-kit/src/lib/ads.service.ts
- fallback trial only consumes on successful output | Trial attempts are spent only after successful generate/save paths, not on failed processing. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- project edit flow now opens from saved books and preview | Saved project entries can be reopened into edit mode instead of starting from scratch. | apps/epub-cover-changer/src/app/pages/my-epubs/my-epubs.page.ts
- project snapshots are persisted before edit mode can open | Auto-save keeps the saved project record usable for editing. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- shared folder prep is centralized through file-kit helpers | Project folders are prepared the same way before snapshot and export writes. | packages/file-kit/src/lib/ensure-directories.ts
- blocking fallback modal now dismisses active tour overlay | Prevents tour overlay from masking fallback confirmation modal. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- skipping home tour now marks editor-tour as seen | Home/editor/remove-ads onboarding behaves as one unified flow when omitted. | apps/epub-cover-changer/src/app/pages/change/change.page.ts
- ad fallback modal remains non-dismissible except accepted role | Enforces explicit acknowledgement before continuing trial export. | packages/ad-fallback-kit/src/lib/ad-fallback.service.ts
## User-facing change facts (increment)
- Rewarded ads can recover after a failed first attempt.
- If the network or blocker state changes, the same session can retry without a full app restart.
- The fallback export path still remains available when the ad flow cannot recover.
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
- localeList: ar, de-DE, en-US, es-419, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual release traceability data, not marketing copy.
- Keep behavior aligned with free tier plus ad fallback trial contract.
- Do not spend trial exports on failed generate/save attempts.
