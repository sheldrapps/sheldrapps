# EF utility
## Project identity
- app: epub-fixer
- alias: ef
- currentVersionCode: 5
- nextVersionCode: 6
- currentVersionName: "Thumbnail persistence"
- nextVersionName: "Thumbnail persistence"
## Product purpose
- Keep EPUB repair dependable and understandable across web and Android.
- Preserve file safety while diagnosis, repair, and export run.
- Keep the Fix flow focused on recovery instead of technical noise.
## Capability inventory (facts)
- format: capability | user-value | evidence
- malformed container recovery reads the declared rootfile path even when XML parsing fails. | Users can repair EPUBs whose container.xml uses a broken rootfiles structure. | packages/file-kit/src/lib/adapters/web-dev-epub-fixer.adapter.ts
- android cover lookup and rewrite share the same raw-text container fallback. | Android can repair artifact 15 instead of stopping at a zip container read error. | plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubRewritePlugin.java
- the container fallback also supports malformed rootfile markup in the cover locator. | The Android plugin can still resolve the package document when rootfiles parsing breaks. | plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubCoverLocator.java
## User-facing change facts (increment)
- Preview thumbnails are now persisted, so My EPUBs can reuse them without a manual refresh.
- Fallback first-image thumbnails are saved too, keeping books visible even when they do not have a cover file.
## Increment scope facts
- deltaFrom: 3dec6b6e73f46e0db756ac44f5ea0b410fc8ae4d
- deltaTo: 59deb27e5df5a37a2fade5e579e53c18c27ab059
- changedFiles: 6
- packages/file-kit/src/lib/adapters/web-dev-epub-fixer.adapter.ts
- packages/file-kit/src/lib/adapters/web-dev-epub-fixer.adapter.spec.ts
- plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubRewritePlugin.java
- plugins/epub-rewrite/android/src/main/java/com/sheldrapps/plugins/epubrewrite/EpubCoverLocator.java
- plugins/epub-rewrite/android/src/test/java/com/sheldrapps/plugins/epubrewrite/EpubRewritePluginRewriteTest.java
- plugins/epub-rewrite/android/src/test/java/com/sheldrapps/plugins/epubrewrite/EpubCoverLocatorTest.java
## Locale coverage facts
- localeCount: 13
- localeList: ar, de-DE, en-US, es-419, fr-FR, hi-IN, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, zh-CN, zh-TW
## Constraints and non-goals
- Utility is factual release traceability data, not marketing copy.
- Keep claims tied to evidence paths listed above.
