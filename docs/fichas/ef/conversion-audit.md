# EPUB Fixer Conversion Audit

## Purpose

Audit the conversion readiness, product truth, repair-scope accuracy, monetization clarity, trust proof, invalid-file handling, and unsupported-claim risk of each localized Play Store listing for EPUB Fixer.

This audit verifies that every locale preserves the same real product promise:

**Diagnose common EPUB structure issues, explain when a file is not a real EPUB, repair supported problems, and save a repaired EPUB as a new copy.**

The audit should be used after generating localized Play Store listings and before creating, approving, or publishing Play Store visual assets.

The current approved screenshot strategy is compact:

**5 screenshots, clean and neat.**

The listing should not over-explain the internal flow or create redundant screenshots for repair, repaired state, and repair result when those ideas happen in the same product context.

---

## Global Conversion Standard

Every locale must preserve this hierarchy:

1. Recognizable EPUB problem
2. Clear validation of whether the file is really an EPUB
3. Clear diagnosis of a repairable EPUB structure issue
4. Safe repaired-copy output
5. Local file continuity and privacy trust
6. Monetization handled transparently but not as the main selling point
7. No unsupported promises

The first visual impact must show a recovery story:

**Problem EPUB → repaired EPUB copy**

It must not open with settings, a technical report, raw XML, a file picker, an empty library, an abstract privacy claim, a monetization screen, or a generic utility interface.

The listing must never make the app appear to repair every possible EPUB, recover book content that is genuinely missing, bypass DRM, or guarantee that any invalid file can be fixed.

---

## Required Product Truth

Every approved locale must communicate only the repair scope supported by the current build.

Safe high-level promise:

* Diagnose common EPUB issues
* Identify files that are not valid EPUBs
* Repair supported EPUB structure problems
* Create a repaired EPUB copy
* Keep the original unchanged
* Process EPUB file repairs on-device
* Require no account
* Avoid uploads
* Let users find repaired or imported files in My EPUBs
* Offer language/theme settings when relevant
* Offer an option to remove ads
* Use rewarded ads for some free repairs only when applicable

Potentially supported repair examples, only when verified in the current build:

* Missing or invalid `mimetype`
* Missing or unreadable `META-INF/container.xml`
* Missing or unreadable `content.opf`
* Invalid EPUB package structure
* Broken manifest references
* Invalid manifest entries
* Empty or invalid spine
* Invalid spine entries
* Unreadable EPUB ZIP structure
* Files that use `.epub` but are not valid EPUB files
* Rebuilding a corrected EPUB after supported changes

Do not present these as universal guarantees. Use phrasing such as:

* Finds common supported issues
* Repairs compatible structure problems
* Fixes supported EPUB errors
* Creates a repaired copy when possible
* Explains when a file is not a valid EPUB
* Detects files with changed extensions

Avoid phrasing such as:

* Fix any EPUB
* Repair all corrupted books
* Restore damaged book content
* Guaranteed EPUB recovery
* Fix every ebook error
* Make any EPUB work everywhere
* Always works offline, if the free ad-supported flow may need internet
* Free unlimited repairs, if not true

---

## Approved 5-Screenshot Strategy

The approved global screenshot order is:

1. **Main problem**
   EPUB does not open or does not work correctly.

2. **Invalid-file blocking case**
   The file has an `.epub` extension, but it is not a valid EPUB.

3. **Repairable diagnosis case**
   The file is a real EPUB, but a supported structure problem is detected.

4. **Safe repaired-copy result**
   A repaired EPUB copy is saved or ready to save, while the original remains unchanged.

5. **Local library + privacy trust**
   Repaired/imported EPUBs are shown in a local file view, with no-account/no-upload trust proof.

This replaces the older 6–8 screenshot flow that separated:

* file selection/session
* diagnosis
* repair action
* repair result
* save/export
* My EPUBs
* settings
* monetization

Those screens may still appear in the app experience, but they should not force separate Play Store screenshots unless a locale or experiment specifically needs more than the compact set.

---

## Locale Audit Table

| Locale | Approved | Trust proof                                                                              | Hero statement                                                | Product-completeness check                                                                                                              | Risk check                                                                                                                              |
| ------ | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| en-US  | Yes      | On-device file processing. No accounts. No uploads. Original unchanged.                  | Fix common EPUB file issues and save a repaired copy          | My EPUBs and settings may support the final trust/product-completeness story, but should not split the core flow into extra screenshots | Avoid universal-repair language, antivirus styling, monetization-first screenshots, cloud claims, or overly technical XML-first visuals |
| es-MX  | Sí       | Procesamiento en tu dispositivo. Sin cuentas. Sin subir archivos. El original no cambia. | Repara problemas comunes en EPUB y guarda una copia corregida | My EPUBs debe funcionar como cierre local/privado, no como biblioteca de lectura ni tienda                                              | Evitar prometer que cualquier EPUB dañado se puede recuperar, decir “100% offline” en flujo con anuncios, o abrir con pantalla técnica  |
| de-DE  | Sí       | Lokale Verarbeitung. Kein Konto. Kein Upload. Original bleibt erhalten.                  | Häufige EPUB-Probleme prüfen und reparierte Kopie speichern   | Einstellungen und werbefreie Option nur als sekundäre Ergänzung                                                                         | Avoid absolute claims, vague total-recovery language, cleaner-app visuals, or unverified offline claims                                 |
| fr-FR  | Sí       | Traitement local. Aucun compte. Aucun envoi. Original conservé.                          | Diagnostiquer et corriger les problèmes EPUB courants         | Local file continuity can appear in the final screenshot if it does not look like a cloud library or reader                             | Avoid making the product feel like a complex desktop utility, online converter, or ad-first tool                                        |
| it-IT  | Sí       | Elaborazione sul dispositivo. Nessun account. Nessun upload. Originale invariato.        | Trova e correggi i problemi EPUB più comuni                   | My EPUBs and ad-free options must remain secondary                                                                                      | Avoid antivirus appearance, complete-repair promises, or excessive technical terms                                                      |
| pt-BR  | Sí       | Processamento no dispositivo. Sem conta. Sem uploads. Original preservado.               | Corrija problemas comuns em EPUB e salve uma cópia reparada   | My EPUBs can support local ownership and privacy in the final screenshot                                                                | Avoid promises to repair any EPUB, generic cleaner styling, cloud storage, or “100% offline” if ads may be required                     |
| ar-SA  | Sí       | تتم المعالجة على الجهاز. بدون حساب. بدون رفع ملفات. يبقى الأصل دون تغيير.                | اكتشف مشكلات EPUB الشائعة وأصلح الملفات المدعومة              | My EPUBs/settings must remain RTL-safe and secondary                                                                                    | Avoid absolute promises, overloaded technical detail, RTL-unsafe layouts, or dominant monetization                                      |
| hi-IN  | Sí       | On-device processing. No account. No uploads. Original stays unchanged.                  | Diagnose and repair common EPUB issues                        | Keep product completeness simple: repaired files, settings, and remove ads only after core value is clear                               | Avoid jargon-heavy copy, technical-first screens, and generic file-cleaner positioning                                                  |
| ja-JP  | Sí       | 端末上で処理。アカウント不要。アップロード不要。元のファイルはそのまま。                                                     | EPUBの一般的な問題を確認して修復コピーを保存                                      | Product completeness should be minimal, orderly, and secondary                                                                          | Avoid exaggerated repair promises, complex technical explanations, loud error visuals, or ad-first messaging                            |
| ko-KR  | Sí       | 기기에서 처리. 계정 없음. 업로드 없음. 원본은 그대로 유지.                                                      | 일반적인 EPUB 문제를 진단하고 복구 사본 저장                                   | My EPUBs/settings can support product depth after repair proof                                                                          | Avoid looking like a general file manager, antivirus, or universal recovery app                                                         |
| ru-RU  | Sí       | Обработка на устройстве. Без аккаунта. Без загрузки файлов. Оригинал не изменяется.      | Найдите и исправьте распространённые проблемы EPUB            | Local files and settings must not make the app look like a reader, bookstore, or file manager                                           | Do not promise full recovery, DRM support, cloud processing, or universal compatibility                                                 |
| zh-CN  | Sí       | 本地处理。无需账号。不上传文件。原文件不变。                                                                   | 检查常见 EPUB 问题并保存修复副本                                           | My EPUBs and settings should be clean, secondary, and utility-first                                                                     | Avoid implying all damaged files can be repaired, cloud processing, AI repair, or full EPUB editing                                     |
| zh-TW  | Sí       | 在裝置上處理。無需帳號。不需上傳。原始檔案不會變更。                                                               | 檢查常見 EPUB 問題並儲存修復副本                                           | Repaired/imported files and settings should support trust, not replace repair proof                                                     | Avoid looking like antivirus, a file cleaner, a cloud service, or a tool that guarantees every EPUB can be fixed                        |

---

## Scoring Criteria

Score each area from 1 to 5.

| Criterion                    | Target                                                                                                                   | Failure signal                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| App name clarity             | User understands this is an EPUB repair utility                                                                          | Sounds like a generic file fixer, full EPUB editor, reader, antivirus, or universal recovery tool |
| Short description strength   | Clear repair benefit plus EPUB keyword                                                                                   | Too vague, too technical, or promises guaranteed repair                                           |
| Long description clarity     | Practical, accurate, focused on validation → diagnosis → repaired copy                                                   | Too shallow, keyword-stuffed, overly technical, or misleading about repair scope                  |
| Screenshot 1 hook            | Recognizable EPUB problem and repaired outcome                                                                           | Starts with settings, technical report, picker, empty library, privacy claim, or monetization     |
| Problem-to-repair clarity    | The relationship between problematic EPUB and repaired copy is obvious                                                   | Issue and repaired state look too similar or require long explanation                             |
| Invalid-file handling        | Files that are not real EPUBs are explained clearly and calmly                                                           | Uses scary “damaged forever” language or implies repeated repair can fix non-EPUB files           |
| Repairable diagnosis clarity | User understands the file is a real EPUB with a supported issue                                                          | Raw XML, cryptic logs, unexplained error codes, or no diagnostic proof                            |
| Safe-copy reassurance        | User understands the original EPUB remains unchanged                                                                     | Save flow feels like overwrite, deletion, or destructive modification                             |
| My EPUBs clarity             | User understands repaired/imported files can be found again locally                                                      | Looks like an ebook reader, bookstore, cloud library, or generic file manager                     |
| Privacy/trust proof          | On-device file processing, no account, and no upload are visible                                                         | Trust proof absent, hidden, or replaced with cloud language                                       |
| Monetization clarity         | Ads, rewarded ads, fallback, and remove-ads are transparent but secondary                                                | Listing feels like a paywall, promises free unlimited use, or hides ad dependency                 |
| Offline claim safety         | Offline wording is limited to verified flows                                                                             | Says “100% offline” while rewarded ads may require internet                                       |
| Visual specificity           | Asset instructions define palette, safe area, accent, texture, and forbidden elements                                    | Background direction is vague or risks unreadable copy                                            |
| Unsupported claim risk       | No universal repair, DRM, content recovery, AI, cloud, editor, download, official-platform, or unverified offline claims | Any copy or visual implies functionality outside the app’s real scope                             |
| Compact-flow discipline      | The screenshot set avoids redundant “repair / repaired / repair result” visuals                                          | Listing drifts back into 6–8 screenshots without adding distinct conversion value                 |

---

## Recommended Passing Threshold

A locale should be considered approved only if:

* Average score is 4.0 or higher.
* Screenshot 1 hook score is 4 or higher.
* Problem-to-repair clarity score is 4 or higher.
* Invalid-file handling score is 4 or higher.
* Repairable diagnosis clarity score is 4 or higher.
* Safe-copy reassurance score is 4 or higher.
* Privacy/trust proof score is 4 or higher.
* Monetization clarity score is 4 or higher when ads/remove-ads are mentioned.
* Offline claim safety score is 5 when the locale uses offline-related wording.
* Unsupported claim risk score is 5.
* Compact-flow discipline score is 4 or higher.

If unsupported claim risk is below 5, the locale must be revised before publishing.

If offline claim safety is below 5, remove or rewrite offline claims before publishing.

If invalid-file handling is below 4, the visual sequence must be revised before production.

If safe-copy reassurance is below 4, the repaired-copy screenshot must be clarified.

If monetization clarity is below 4, move monetization later in the listing or rewrite it as secondary transparency.

If compact-flow discipline is below 4, remove redundant screenshots unless they are required for a specific localization or experiment.

---

## Mandatory Claim Validation Before Asset Production

Before generating a screenshot, feature graphic, or listing copy that names a repair action, validate it against the current repair engine.

| Proposed visual or copy claim | Verify before use                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| “Fixed missing mimetype”      | The app truly detects and repairs invalid or missing `mimetype`                                                      |
| “Rebuilt package structure”   | The app reconstructs the supported package structure in the current build                                            |
| “Fixed container file”        | The app can handle missing or unreadable `META-INF/container.xml`                                                    |
| “Fixed content file”          | The app can handle missing or unreadable `content.opf` or OPF package data                                           |
| “Removed broken references”   | The repair engine actually removes or corrects broken manifest references                                            |
| “Fixed spine entries”         | The app truly detects and corrects invalid or empty spine entries                                                    |
| “Repaired EPUB”               | The result is a newly generated EPUB file, not only a diagnostic report                                              |
| “Original unchanged”          | The app saves a separate file and does not silently overwrite source input                                           |
| “Not a valid EPUB”            | The app actually detects invalid EPUB/ZIP structure or non-EPUB content behind an `.epub` extension                  |
| “Changed extension”           | The app can explain that the file extension does not match the internal structure                                    |
| “No uploads”                  | No EPUB file content is sent to cloud or third-party services                                                        |
| “Works on your device”        | Repair processing is performed locally in the app                                                                    |
| “100% offline”                | The entire referenced flow works without internet, including monetization/access gates                               |
| “Free repair”                 | The free repair flow works as described, including rewarded-ad requirements if applicable                            |
| “Fallback if ad cannot load”  | The app has a real fallback path and user-facing explanation                                                         |
| “My EPUBs”                    | The screen actually shows repaired/imported files and does not imply reading, syncing, downloading, or selling books |

If a repair is uncertain, use broader but accurate wording:

* Issue found
* Supported problem detected
* Repair applied where possible
* Repaired copy created
* Review the result before saving
* This file is not a valid EPUB
* The app explains what happened

---

## Locale Notes

### en-US

Conversion angle:

A practical solution for EPUB files that do not open, fail to import, or are not really valid EPUBs.

Most important proof:

Invalid-file detection, clear diagnosis before repair, and a repaired-copy result.

Visual priority:

EPUB not opening → is it really an EPUB? → structure issue found → repaired copy → local control.

Product-completeness note:

My EPUBs, settings, and remove-ads may appear as final or secondary support, but the core five screenshots should stay focused on problem, validation, diagnosis, safe result, and local control.

Main risk:

Overpromising universal recovery, looking like a generic antivirus, presenting technical internals before the user understands the problem, or making monetization too prominent.

---

### es-MX

Conversion angle:

“¿Tu EPUB no abre bien?” followed by a simple, understandable path: verify if it is a real EPUB, explain what failed, and save a repaired copy when possible.

Most important proof:

La app distingue archivos que no son EPUB reales, explica qué falló en los casos reparables y no modifica el archivo original.

Visual priority:

Problema visible → validación EPUB real → diagnóstico reparable → copia reparada → control local.

Product-completeness note:

My EPUBs debe cerrar como prueba de continuidad local y privacidad. Ajustes y quitar anuncios deben ser soporte secundario, no parte central del set.

Main risk:

Prometer que cualquier EPUB dañado puede repararse, usar lenguaje demasiado técnico, decir “100% offline” si el flujo gratuito depende de anuncios, o abrir la ficha con una pantalla de diagnóstico sin contexto.

---

### de-DE

Conversion angle:

Precise EPUB validation and controlled repair of supported file issues.

Most important proof:

Local processing, invalid-file explanation, clear findings, and an unchanged original file.

Visual priority:

Structured, restrained, exact, utility-first visual language.

Product-completeness note:

Settings and ad-free options should be factual, minimal, and secondary.

Main risk:

Exaggerated emotional wording, vague “magic repair” language, universal compatibility claims, cluttered visual composition, or unverified offline claims.

---

### fr-FR

Conversion angle:

Simple and clear EPUB recovery with transparent validation and diagnosis.

Most important proof:

Local treatment, clear invalid-file handling, concise repair explanation, and a safe separate copy.

Visual priority:

Refined but practical layouts with clear progress from problem to repaired result.

Product-completeness note:

A local files screen can support trust if it does not look like a cloud library or reader.

Main risk:

Making the product feel like a technical desktop utility, cloud service, opaque automatic repair process, or ad-first tool.

---

### it-IT

Conversion angle:

Repair common EPUB problems quickly while keeping the original file safe.

Most important proof:

Invalid EPUB detection, visible repairable diagnosis, and local processing.

Visual priority:

Accessible, direct, polished utility visuals with a clear before-and-after story.

Product-completeness note:

Use settings/remove-ads only as secondary polish.

Main risk:

Looking like a general file-cleaning app or making claims about complete ebook restoration.

---

### pt-BR

Conversion angle:

Find common EPUB issues, explain invalid files, repair compatible problems, and save a new corrected copy.

Most important proof:

On-device processing and original-file preservation.

Visual priority:

Strong recovery transformation, readable status labels, and simple workflow proof.

Product-completeness note:

My EPUBs can help show practical ownership and local continuity.

Main risk:

Promises around repairing any damaged EPUB, cloud storage, generic device-cleaner styling, or offline claims that conflict with rewarded ads.

---

### ar-SA

Conversion angle:

Clear, private EPUB validation and supported repair with a safe new copy.

Most important proof:

Original remains unchanged, no upload, invalid files are explained clearly, and repair results are understandable.

Visual priority:

RTL-safe hierarchy, generous copy-safe area, concise text, and controlled visual emphasis.

Product-completeness note:

My EPUBs and settings screens must be mirrored or otherwise safe for RTL layout. Avoid cramming long text.

Main risk:

Overloaded text, insufficient RTL adaptation, excessive decoration, guaranteed recovery claims, or monetization copy that creates distrust.

---

### hi-IN

Conversion angle:

A straightforward mobile utility for checking and repairing common EPUB file issues.

Most important proof:

Invalid-file detection, diagnosis before repair, local processing, and a separate repaired file.

Visual priority:

Clear English or localized messaging, short copy, and obvious recovery state.

Product-completeness note:

Keep product completeness simple: repaired files, settings, and remove ads should not crowd the core promise.

Main risk:

Complex technical terms, too much diagnostic detail, or generic file-tool positioning.

---

### ja-JP

Conversion angle:

A precise and minimal way to inspect EPUB issues and save a repaired copy.

Most important proof:

Transparent local handling, invalid-file explanation, and original preservation.

Visual priority:

Minimal, orderly, quiet confidence; the file-state transformation should carry the message.

Product-completeness note:

Settings and ad-free communication should be calm, factual, and later in the sequence.

Main risk:

Aggressive warning visuals, lengthy technical terminology, dramatic error imagery, or ad-first messaging.

---

### ko-KR

Conversion angle:

A modern, practical EPUB recovery workflow: validate, diagnose, repair compatible issues, and save a separate result.

Most important proof:

Real repairable-diagnosis screen plus fully local file processing.

Visual priority:

Clean UI proof, restrained color, and concise status language.

Product-completeness note:

A later My EPUBs screen can strengthen product depth if it remains utility-first.

Main risk:

Looking like a general file-management app, an antivirus, or a tool that promises to repair all files.

---

### ru-RU

Conversion angle:

Practical EPUB troubleshooting and repair with visible results and local privacy.

Most important proof:

Clear invalid-file handling, repairable diagnosis, repaired-copy output, and original-file preservation.

Visual priority:

Serious, direct, utility-first presentation.

Product-completeness note:

Avoid making My EPUBs look like a reading library or content source.

Main risk:

Implying full EPUB editing, DRM support, cloud processing, guaranteed recovery, or unrestricted free repair.

---

### zh-CN

Conversion angle:

Fast, local diagnosis and repair of common EPUB issues with a separate saved copy.

Most important proof:

Local file processing, no account, no upload, original file unchanged, and clear invalid-file explanation.

Visual priority:

Efficient, clean, utility-first composition with a clear issue-to-repair transition.

Product-completeness note:

Settings/remove-ads should be utility support, not the main visual.

Main risk:

Implying complete EPUB editing, cloud repair, AI processing, universal recovery capability, or unverified offline behavior.

---

### zh-TW

Conversion angle:

A clear local workflow for checking EPUB problems and saving a repaired version.

Most important proof:

Transparent repairable diagnosis, preserved original, and invalid-file clarity.

Visual priority:

Polished, trust-oriented, concise visual language with strong recovery proof.

Product-completeness note:

My EPUBs can support the idea of local file continuity if it does not resemble a bookstore or reader shelf.

Main risk:

Looking like a cloud file service, a generic cleanup app, or a tool that guarantees every EPUB can be fixed.

---

## Global Findings

All approved variants must maintain the same real product identity:

**EPUB Fixer diagnoses common supported EPUB problems, identifies files that are not real EPUBs, repairs compatible structural issues, and creates a separate repaired EPUB copy.**

The approved compact conversion hierarchy is:

**Problem → real EPUB validation → repairable diagnosis → repaired copy → local control.**

No locale should introduce claims about:

* Repairing every EPUB
* Guaranteed file recovery
* Restoring missing book text or chapters
* Repairing DRM-protected books
* Removing DRM
* Editing complete EPUB content
* Metadata editing unless verified
* Ebook downloads
* Free books
* Universal ebook-reader compatibility
* Official affiliation with ebook platforms
* Cloud processing
* AI repair
* Antivirus or malware cleaning
* Universal file recovery
* Unlimited free repairs unless true
* Full offline behavior unless verified for the specific flow

The main trust proof is consistent across locales:

**Files are processed on the device, no account is required, no upload is needed, and the original EPUB remains unchanged.**

The largest global conversion risk is making EPUB Fixer look like either:

* a generic file cleaner
* a universal recovery tool
* a full EPUB editor
* an ebook reader/store
* a cloud repair service
* an ad-first app

To avoid this, every locale must lead with a realistic EPUB-specific problem, include the invalid-file case, show a repairable diagnosis, make the repaired-copy outcome visible, and keep monetization as secondary transparency.

---

## Required Fixes Before Publishing Any Locale

Revise the locale if any of these appear:

* Screenshot 1 begins with diagnostic logs, technical settings, a file picker, library-only UI, privacy-only claim, or monetization.
* The screenshot set separates repair, repaired state, and repair result into redundant visuals without a distinct conversion reason.
* The invalid-file / changed-extension case is missing from the approved 5-screenshot set.
* Copy says or implies “fix any EPUB,” “repair all EPUBs,” or “guaranteed recovery.”
* Copy suggests lost book content, deleted chapters, or DRM can be recovered.
* Copy says or implies the app removes DRM.
* Copy implies full EPUB editing, ebook conversion, or universal compatibility.
* Copy implies official affiliation with Kindle, Kobo, Adobe, Apple Books, Google Play Books, or another ebook platform.
* The visual language resembles antivirus, malware cleaning, hacker tools, ZIP extraction, or a phone optimizer.
* The visual language resembles a PDF repair product rather than an EPUB utility.
* Diagnostic details dominate the first screenshot.
* Repair-result labels name operations not actually performed by the current app build.
* The save screen suggests overwrite rather than a separate repaired copy.
* Local processing, no account, or no-upload proof is absent from both description and screenshots.
* The original and repaired EPUB are visually indistinguishable.
* Headline readability is weakened by bright backgrounds, glow, or dense visual effects.
* RTL layouts are not mirrored or copy-safe for Arabic locales.
* My EPUBs appears to be an ebook reader, bookstore, or cloud-synced library.
* Settings/remove-ads appears before the repair value is proven.
* Rewarded ads are presented as a core benefit instead of an access/monetization mechanism.
* The listing says “100% offline” while the free flow may require rewarded ads or internet.
* Fallback claims are shown without a real implemented fallback.
* Example books, filenames, covers, or thumbnails use works with active copyright in the target locale.

---

## Example Content Rule

When screenshots use book titles, filenames, thumbnails, or cover-style examples:

* Use popular books without copyright restrictions in the target locale.
* Do not use currently copyrighted works.
* Do not use real publisher branding.
* Do not imply the app provides, downloads, sells, or distributes books.
* Final title selection should happen during screenshot production, not inside the golden or audit.

---

## Final Conclusion

The localized EPUB Fixer direction is approved when it preserves the app’s actual repair scope and tells a believable compact recovery story.

The strongest global conversion path is:

**EPUB not working correctly → check whether it is really an EPUB → understand the repairable issue → save a repaired copy → keep EPUBs local and private.**

The strongest global visual strategy is:

**The same EPUB shown in clear, distinct states: problem detected, valid/invalid file explained, repairable issue found, repaired copy ready, local file control.**

The strongest global trust proof is:

**File repair is processed on the device. No accounts. No uploads. The original EPUB remains unchanged.**

The strongest product-completeness proof is:

**Repaired and imported files can be found again in My EPUBs, while language, theme, and remove-ads options remain secondary support features.**

Future generated fichas should use this audit as an active QA checklist, not only as a summary document.
