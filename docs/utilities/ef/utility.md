# EF utility
## Project identity
- app: epub-fixer
- alias: ef
- currentVersionCode: 2
- nextVersionCode: 3
- currentVersionName: "1.1"
- nextVersionName: "1.1"
## Product purpose
- Keep EPUB repair dependable and understandable across web and Android.
- Preserve file safety while diagnosis, repair, and export run.
- Keep the Fix flow focused on recovery instead of technical noise.
## Capability inventory (facts)
- format: capability | user-value | evidence
- diagnosis, repair, and export all run from the Fix screen. | Users can recover damaged EPUBs from one focused flow. | apps/epub-fixer/src/app/pages/fix/fix.page.ts
- large browser files trigger a warning before processing. | Users get a clear heads-up when web files may be slow or fail. | apps/epub-fixer/src/app/services/epub-fixer-workflow.service.ts
- the Fix screen no longer shows the web development badge. | The UI stays cleaner on web without extra chrome. | apps/epub-fixer/src/app/pages/fix/fix.page.html
## User-facing change facts (increment)
- The Fix screen no longer shows the web development badge.
## Increment scope facts
- deltaFrom: 3dec6b6e73f46e0db756ac44f5ea0b410fc8ae4d
- deltaTo: 3dec6b6e73f46e0db756ac44f5ea0b410fc8ae4d
- changedFiles: 1
- apps/epub-fixer/android/app/build.gradle
## Locale coverage facts
- localeCount: 13
- localeList: ar, de-DE, en-US, es-MX, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual release traceability data, not marketing copy.
- Keep claims tied to evidence paths listed above.
