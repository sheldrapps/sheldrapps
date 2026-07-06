# EF utility
## Project identity
- app: epub-fixer
- alias: ef
- currentVersionCode: 6
- nextVersionCode: 7
- currentVersionName: "Ad fallback repair trial"
- nextVersionName: "Ad fallback repair trial"
## Product purpose
- Keep EPUB repair dependable when rewarded ads fail to load.
- Preserve a single ad-free repair fallback without forcing an app restart.
- Keep the Fix flow focused on recovery instead of ad-service retries.
## Capability inventory (facts)
- format: capability | user-value | evidence
- malformed container recovery reads the declared rootfile path even when XML parsing fails. | Users can repair EPUBs whose container.xml uses a broken rootfiles structure. | packages/file-kit/src/lib/adapters/web-dev-epub-fixer.adapter.ts
- android cover lookup and rewrite share the same raw-text container fallback. | Android can repair artifact 15 instead of stopping at a zip container read error. | plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubRewritePlugin.java
- the container fallback also supports malformed rootfile markup in the cover locator. | The Android plugin can still resolve the package document when rootfiles parsing breaks. | plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubCoverLocator.java
- rewarded ad failures now open the shared fallback offer. | Users can continue the repair flow when the ad cannot load. | apps/epub-fixer/src/app/pages/fix/fix.page.ts
- the fallback is limited to one accepted ad-free attempt. | Free users get a single recovery window instead of an unbounded bypass. | apps/epub-fixer/src/app/pages/fix/fix.page.ts
- fallback state is stored in app preferences. | The accepted trial survives a transient failure and does not require a manual app restart. | apps/epub-fixer/src/app/pages/fix/fix.page.ts
- epub-fixer registers fallback translations on web and native startup. | The fallback modal copy is available in both runtime entry points. | apps/epub-fixer/src/main.ts
- the fallback copy includes an EF-specific variant. | EPUB Fixer shows app-specific wording instead of a generic fallback label. | packages/ad-fallback-kit/src/lib/ad-fallback.translations.ts
- rewarded-ad load failure handling distinguishes failure reasons and confidence. | The retry prompt can reflect why the ad path failed. | apps/epub-fixer/src/app/pages/fix/fix.page.ts
## User-facing change facts (increment)
- EPUB Fixer now offers one ad-free repair attempt if a rewarded ad cannot load.
- Users do not need to force-close the app to recover after changing network or ad-blocking conditions.
- The repair flow can continue in the same session after an ad-service failure.
## Increment scope facts
- deltaFrom: 85c340a5f0d1b32a67cc8b77dceff50ae9037721
- deltaTo: 829ac10055d50efbd7f2f35b092e5d25daea3412
- changedFiles: 10
- apps/epub-fixer/android/app/build.gradle
- apps/epub-fixer/package.json
- apps/epub-fixer/src/app/pages/fix/fix.page.spec.ts
- apps/epub-fixer/src/app/pages/fix/fix.page.ts
- apps/epub-fixer/src/main.native.ts
- apps/epub-fixer/src/main.ts
- apps/epub-fixer/tsconfig.app.json
- apps/epub-fixer/tsconfig.json
- packages/ad-fallback-kit/src/lib/ad-fallback.translations.ts
- packages/ad-fallback-kit/src/lib/ad-fallback.types.ts
## Locale coverage facts
- localeCount: 13
- localeList: ar, de-DE, en-US, es-419, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual release traceability data, not marketing copy.
- Keep claims tied to evidence paths listed above.
- Do not describe internal kit mechanics as user-facing behavior.
