# EPUB Fixer Conversion Audit

## Purpose

Audit the conversion readiness, product truth, repair-scope accuracy, monetization clarity, trust proof, and unsupported-claim risk of each localized Play Store listing for EPUB Fixer.

This audit verifies that every locale preserves the same real product promise:

Diagnose common supported EPUB structure issues, repair what the app can handle, explain the result, and save a repaired EPUB as a new copy.

The audit should be used after generating localized fichas and before creating, approving, or publishing Play Store visual assets.

## Global Conversion Standard

Every locale must preserve this hierarchy:

1. Recognizable EPUB problem
2. Local EPUB selection or clear file context
3. Safe repair session
4. Clear diagnosis
5. Supported repair
6. Visible repair result
7. Safe new-copy output
8. Local/private processing
9. Local file continuity through My EPUBs when shown
10. Monetization handled transparently but not as the main selling point
11. No unsupported promises

The first visual impact must show a recovery story:

Problem EPUB → repaired EPUB copy

It must not open with settings, a technical report, raw XML, a file picker, an empty library, an abstract privacy claim, a monetization screen, or a generic utility interface.

The listing must never make the app appear to repair every possible EPUB or recover book content that is genuinely missing.

## Required Product Truth

Every approved locale must communicate only the repair scope supported by the current build.

Safe high-level promise:

* Diagnose common EPUB issues
* Repair supported EPUB structure problems
* Create a repaired EPUB copy
* Keep the original unchanged
* Process EPUB file repairs on-device
* Require no account
* Avoid uploads
* Provide clear handling for files that are not real EPUBs
* Let users find repaired or imported files in My EPUBs
* Offer language/theme settings
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

Avoid phrasing such as:

* Fix any EPUB
* Repair all corrupted books
* Restore damaged book content
* Guaranteed EPUB recovery
* Fix every ebook error
* Make any EPUB work everywhere
* Always works offline, if the free ad-supported flow may need internet
* Free unlimited repairs, if not true

## Locale Audit Table

| Locale | Aprobado | Prueba de confianza                                                                      | Hero statement                                                | Product-completeness check                                                                  | Risk check                                                                                                                            |
| ------ | -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| en-US  | Sí       | On-device file processing. No accounts. No uploads. Original unchanged.                  | Fix common EPUB file issues and save a repaired copy          | May include My EPUBs, settings, and remove-ads only after core repair flow is clear         | Avoid universal-repair language, antivirus styling, monetization-first screenshots, or overly technical XML-first visuals             |
| es-MX  | Sí       | Procesamiento en tu dispositivo. Sin cuentas. Sin subir archivos. El original no cambia. | Repara problemas comunes en EPUB y guarda una copia corregida | Puede mostrar My EPUBs y ajustes como señales secundarias de producto completo              | Evitar prometer que cualquier EPUB dañado se puede recuperar, decir “100% offline” en flujo con anuncios o abrir con pantalla técnica |
| de-DE  | Sí       | Lokale Verarbeitung. Kein Konto. Kein Upload. Original bleibt erhalten.                  | Häufige EPUB-Probleme prüfen und reparierte Kopie speichern   | Einstellungen und werbefreie Option nur als sekundäre Ergänzung                             | Evitar claims absolutos, lenguaje ambiguo de recuperación total, estética de limpiador o promesas offline no verificadas              |
| fr-FR  | Sí       | Traitement local. Aucun compte. Aucun envoi. Original conservé.                          | Diagnostiquer et corriger les problèmes EPUB courants         | Bibliothèque locale et réglages pueden aparecer después de la reparación                    | Evitar que parezca herramienta técnica compleja, servicio de conversión online o paywall                                              |
| it-IT  | Sí       | Elaborazione sul dispositivo. Nessun account. Nessun upload. Originale invariato.        | Trova e correggi i problemi EPUB più comuni                   | My EPUBs y opción sin anuncios deben ser secundarios                                        | Evitar apariencia de antivirus, promesas de reparación completa o tecnicismos excesivos                                               |
| pt-BR  | Sí       | Processamento no dispositivo. Sem conta. Sem uploads. Original preservado.               | Corrija problemas comuns em EPUB e salve uma cópia reparada   | Puede comunicar archivos reparados/importados y opción sin anuncios sin distraer del flujo  | Evitar promesas de reparar cualquier EPUB, estilo de limpieza genérica o “100% offline” si hay anuncios                               |
| ar-SA  | Sí       | تتم المعالجة على الجهاز. بدون حساب. بدون رفع ملفات. يبقى الأصل دون تغيير.                | اكتشف مشكلات EPUB الشائعة وأصلح الملفات المدعومة              | My EPUBs/settings must remain RTL-safe and secondary                                        | تجنب promesas absolutas, exceso de detalles técnicos, composiciones no seguras para RTL o monetización dominante                      |
| hi-IN  | Sí       | On-device processing. No account. No uploads. Original stays unchanged.                  | Diagnose and repair common EPUB issues                        | Keep product completeness simple: repaired files, settings, remove ads only after core flow | Avoid jargon-heavy copy, technical-first screens, and generic file-cleaner positioning                                                |
| ja-JP  | Sí       | 端末上で処理。アカウント不要。アップロード不要。元のファイルはそのまま。                                                     | EPUBの一般的な問題を確認して修復コピーを保存                                      | Product completeness should be minimal and orderly                                          | Avoid exaggerated repair promises, complex technical explanations, loud error visuals, or ad-first messaging                          |
| ko-KR  | Sí       | 기기에서 처리. 계정 없음. 업로드 없음. 원본은 그대로 유지.                                                      | 일반적인 EPUB 문제를 진단하고 복구 사본 저장                                   | My EPUBs/settings can support product depth after repair proof                              | Avoid looking like a general file manager, antivirus, or universal recovery app                                                       |
| ru-RU  | Sí       | Обработка на устройстве. Без аккаунта. Без загрузки файлов. Оригинал не изменяется.      | Найдите и исправьте распространённые проблемы EPUB            | Local files and settings must not make the app look like a reader or manager                | Не обещать полное восстановление, поддержку DRM, облачную обработку или универсальную совместимость                                   |
| zh-CN  | Sí       | 本地处理。无需账号。不上传文件。原文件不变。                                                                   | 检查常见 EPUB 问题并保存修复副本                                           | My EPUBs and settings should be clean, secondary, and utility-first                         | 避免暗示可修复所有损坏文件、云端处理、AI 修复或完整 EPUB 编辑                                                                                                   |
| zh-TW  | Sí       | 在裝置上處理。無需帳號。不需上傳。原始檔案不會變更。                                                               | 檢查常見 EPUB 問題並儲存修復副本                                           | Repaired/imported files and settings should support trust, not replace repair proof         | 避免看起來像防毒、檔案清理工具、雲端服務或保證修復所有 EPUB                                                                                                      |

## Scoring Criteria

Score each area from 1 to 5.

| Criterion                     | Target                                                                                                                   | Failure signal                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| App name clarity              | User understands this is an EPUB repair utility                                                                          | Sounds like a generic file fixer, full EPUB editor, reader, antivirus, or universal recovery tool |
| Short description strength    | Clear repair benefit plus EPUB keyword                                                                                   | Too vague, too technical, or promises guaranteed repair                                           |
| Long description clarity      | Practical, accurate, focused on selection → diagnosis → repair → copy                                                    | Too shallow, keyword-stuffed, overly technical, or misleading about repair scope                  |
| Screenshot 1 hook             | Recognizable EPUB problem and repaired outcome                                                                           | Starts with settings, technical report, picker, empty library, privacy claim, or monetization     |
| Problem-to-repair clarity     | The relationship between original and repaired EPUB is obvious                                                           | Issue and repaired state look too similar or need long explanation                                |
| Session clarity               | User understands the selected EPUB is prepared safely before repair                                                      | The flow feels like immediate destructive modification or generic file picking                    |
| Diagnosis clarity             | Users understand the app checks what is wrong before repair                                                              | Raw XML, cryptic logs, unexplained error codes, or no diagnostic proof                            |
| Repair workflow clarity       | Shows repair of supported issues in an understandable way                                                                | Looks magical, vague, generic, or implies every issue can be fixed                                |
| Repair-result proof           | User can see what was repaired or changed                                                                                | No summary, vague “success” state, or claims not tied to actual engine behavior                   |
| Safe-copy reassurance         | User understands the original EPUB remains unchanged                                                                     | Save flow feels like overwrite, deletion, or destructive modification                             |
| Invalid-file handling         | Files that are not real EPUBs are explained clearly                                                                      | Uses scary “damaged forever” language or implies repeated repair can fix non-EPUB files           |
| My EPUBs clarity              | User understands repaired/imported files can be found again locally                                                      | Looks like an ebook reader, bookstore, cloud library, or generic file manager                     |
| Settings/product completeness | Language, theme, and remove-ads are shown as secondary product polish                                                    | Settings or monetization becomes the main value proposition                                       |
| Monetization clarity          | Ads, rewarded ads, fallback, and remove-ads are transparent but secondary                                                | Listing feels like a paywall, promises free unlimited use, or hides ad dependency                 |
| Privacy/trust proof           | On-device file processing, no account, and no upload are visible                                                         | Trust proof absent, hidden, or replaced with cloud language                                       |
| Offline claim safety          | Offline wording is limited to verified flows                                                                             | Says “100% offline” while rewarded ads may require internet                                       |
| Visual specificity            | Asset instructions define palette, safe area, accent, texture, and forbidden elements                                    | Background direction is vague or risks unreadable copy                                            |
| Unsupported claim risk        | No universal repair, DRM, content recovery, AI, cloud, editor, download, official-platform, or unverified offline claims | Any copy or visual implies functionality outside the app’s real scope                             |

## Recommended Passing Threshold

A locale should be considered approved only if:

* Average score is 4.0 or higher.
* Screenshot 1 hook score is 4 or higher.
* Problem-to-repair clarity score is 4 or higher.
* Diagnosis clarity score is 4 or higher.
* Safe-copy reassurance score is 4 or higher.
* Privacy/trust proof score is 4 or higher.
* Monetization clarity score is 4 or higher when ads/remove-ads are mentioned.
* Offline claim safety score is 5 when the locale uses offline-related wording.
* Unsupported claim risk score is 5.

If unsupported claim risk is below 5, the locale must be revised before publishing.

If offline claim safety is below 5, remove or rewrite offline claims before publishing.

If the repair-result proof score is below 4, the visual sequence must be revised before production.

If monetization clarity is below 4, move monetization later in the listing or rewrite it as secondary transparency.

## Mandatory Claim Validation Before Asset Production

Before generating a screenshot, feature graphic, or listing copy that names a repair action, validate it against the current repair engine.

Use this checklist:

| Proposed visual or copy claim | Verify before use                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| “Fixed missing mimetype”      | The app truly detects and repairs invalid or missing `mimetype`                                             |
| “Rebuilt package structure”   | The app reconstructs the supported package structure in the current build                                   |
| “Fixed container file”        | The app can handle missing or unreadable `META-INF/container.xml`                                           |
| “Fixed content file”          | The app can handle missing or unreadable `content.opf` or the OPF package data                              |
| “Removed broken references”   | The repair engine actually removes or corrects broken manifest references                                   |
| “Fixed spine entries”         | The app truly detects and corrects invalid or empty spine entries                                           |
| “Repaired EPUB”               | The result is a newly generated EPUB file, not only a diagnostic report                                     |
| “Original unchanged”          | The app saves a separate file and does not silently overwrite source input                                  |
| “No uploads”                  | No EPUB file content is sent to cloud or third-party services                                               |
| “Works on your device”        | Repair processing is performed locally in the app                                                           |
| “100% offline”                | The entire referenced flow works without internet, including monetization/access gates                      |
| “Free repair”                 | The free repair flow works as described, including rewarded-ad requirements if applicable                   |
| “Fallback if ad cannot load”  | The app has a real fallback path and user-facing explanation                                                |
| “My EPUBs”                    | The screen actually shows repaired/imported files and does not imply reading, syncing, or downloading books |

If a repair is uncertain, use broader but accurate wording:

* Issue found
* Supported problem detected
* Repair applied where possible
* Repaired copy created
* Review the result before saving
* This file is not a valid EPUB
* The app explains what happened

## Locale Notes

### en-US

Conversion angle:

A practical solution for EPUB files that do not open or behave correctly.

Most important proof:

Clear diagnosis before repair, followed by a repaired-copy result.

Visual priority:

Broken EPUB → diagnosis → repaired EPUB copy, using a capable charcoal utility aesthetic with controlled recovery-red or calm slate-blue emphasis.

Product-completeness note:

My EPUBs, settings, and remove-ads may appear in later screenshots, but the first four visuals should stay focused on problem, diagnosis, repair, and proof.

Main risk:

Overpromising universal recovery, looking like a generic antivirus, presenting technical internals before the user understands the result, or making monetization too prominent.

### es-MX

Conversion angle:

“¿Tu EPUB no abre bien?” followed by a simple, understandable path toward a repaired copy.

Most important proof:

La app explica qué falló, aplica correcciones compatibles y no modifica el archivo original.

Visual priority:

Problema visible → diagnóstico claro → copia reparada, con lenguaje directo y sin intimidar al usuario con términos técnicos.

Product-completeness note:

My EPUBs puede funcionar bien como prueba de continuidad local. Ajustes y quitar anuncios deben aparecer como cierre o soporte, no como propuesta principal.

Main risk:

Prometer que cualquier EPUB dañado puede repararse, usar lenguaje demasiado técnico, decir “100% offline” si el flujo gratuito depende de anuncios, o abrir la ficha con una pantalla de diagnóstico sin contexto.

### de-DE

Conversion angle:

Precise EPUB diagnosis and controlled repair of supported file issues.

Most important proof:

Local processing, clear findings, and an unchanged original file.

Visual priority:

Structured, restrained, exact, utility-first visual language.

Product-completeness note:

Settings and ad-free options should be factual, minimal, and not emotional.

Main risk:

Exaggerated emotional wording, vague “magic repair” language, universal compatibility claims, cluttered visual composition, or unverified offline claims.

### fr-FR

Conversion angle:

Simple and clear EPUB recovery with a transparent diagnostic process.

Most important proof:

Local treatment, concise repair explanation, and a safe separate copy.

Visual priority:

Refined but practical layouts with clear progress from problem to repaired result.

Product-completeness note:

A local files screen can support trust if it does not look like a cloud library or reader.

Main risk:

Making the product feel like a technical desktop utility, a cloud service, an opaque automatic repair process, or an ad-first tool.

### it-IT

Conversion angle:

Repair common EPUB problems quickly while keeping the original file safe.

Most important proof:

A visible repair summary and local processing.

Visual priority:

Accessible, direct, polished utility visuals with a clear before-and-after story.

Product-completeness note:

Use settings/remove-ads only as secondary polish.

Main risk:

Looking like a general file-cleaning app or making claims about complete ebook restoration.

### pt-BR

Conversion angle:

Find common EPUB issues, repair compatible problems, and save a new corrected copy.

Most important proof:

On-device processing and original-file preservation.

Visual priority:

Strong recovery transformation, readable status labels, and simple workflow proof.

Product-completeness note:

My EPUBs can help show practical ownership and local continuity.

Main risk:

Promises around repairing any damaged EPUB, cloud storage, generic device-cleaner styling, or offline claims that conflict with rewarded ads.

### ar-SA

Conversion angle:

Clear, private EPUB diagnosis and supported repair with a safe new copy.

Most important proof:

Original remains unchanged, no upload, and repair results are explained.

Visual priority:

RTL-safe hierarchy, generous copy-safe area, concise text, and controlled visual emphasis.

Product-completeness note:

My EPUBs and settings screens must be mirrored or otherwise safe for RTL layout. Avoid cramming long text.

Main risk:

Overloaded text, insufficient RTL adaptation, excessive decoration, claims that imply guaranteed recovery, or monetization copy that creates distrust.

### hi-IN

Conversion angle:

A straightforward mobile utility for finding and repairing common EPUB file issues.

Most important proof:

Diagnosis before repair, local processing, and a separate repaired file.

Visual priority:

Clear English or localized messaging, short copy, and obvious recovery state.

Product-completeness note:

Keep the product completeness simple: repaired files, settings, and remove ads should not crowd the core promise.

Main risk:

Complex technical terms, too much diagnostic detail, or generic file-tool positioning.

### ja-JP

Conversion angle:

A precise and minimal way to inspect EPUB issues and save a repaired copy.

Most important proof:

Transparent local handling and original preservation.

Visual priority:

Minimal, orderly, quiet confidence; the file-state transformation should carry the message.

Product-completeness note:

Settings and ad-free communication should be calm, factual, and later in the sequence.

Main risk:

Aggressive warning visuals, lengthy technical terminology, dramatic error imagery, or ad-first messaging.

### ko-KR

Conversion angle:

A modern, practical EPUB recovery workflow: diagnose, repair compatible issues, and save a separate result.

Most important proof:

Real repair-result screen plus fully local file processing.

Visual priority:

Clean UI proof, restrained color, and concise status language.

Product-completeness note:

A later My EPUBs screen can strengthen product depth if it remains utility-first.

Main risk:

Looking like a general file-management app, an antivirus, or a tool that promises to repair all files.

### ru-RU

Conversion angle:

Practical EPUB troubleshooting and repair with visible results and local privacy.

Most important proof:

Clear diagnosis, repaired-copy output, and original-file preservation.

Visual priority:

Serious, direct, utility-first presentation.

Product-completeness note:

Avoid making My EPUBs look like a reading library or content source.

Main risk:

Implying full EPUB editing, DRM support, cloud processing, guaranteed recovery, or unrestricted free repair.

### zh-CN

Conversion angle:

Fast, local diagnosis and repair of common EPUB issues with a separate saved copy.

Most important proof:

Local file processing, no account, no upload, and original file unchanged.

Visual priority:

Efficient, clean, utility-first composition with a clear issue-to-repair transition.

Product-completeness note:

Settings/remove-ads should be utility support, not the main visual.

Main risk:

Implying complete EPUB editing, cloud repair, AI processing, universal recovery capability, or unverified offline behavior.

### zh-TW

Conversion angle:

A clear local workflow for checking EPUB problems and saving a repaired version.

Most important proof:

Transparent repair result and preserved original.

Visual priority:

Polished, trust-oriented, concise visual language with strong recovery proof.

Product-completeness note:

My EPUBs can support the idea of local file continuity if it does not resemble a bookstore or reader shelf.

Main risk:

Looking like a cloud file service, a generic cleanup app, or a tool that guarantees every EPUB can be fixed.

## Global Findings

All approved variants must maintain the same real product identity:

The app diagnoses common supported EPUB problems, repairs compatible structural issues, and creates a separate repaired EPUB copy.

The conversion hierarchy is aligned:

Problem → session → diagnosis → repair → proof → safe copy → local control.

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

Files are processed on the device, no account is required, no upload is needed, and the original EPUB remains unchanged.

The first visual impact must show a clear recovery transformation.

The largest global conversion risk is making EPUB Fixer look like either a generic file cleaner, a universal recovery tool, or an ad-first app.

To avoid this, every locale must lead with a realistic EPUB-specific problem, show diagnosis before repair, make the repaired-copy outcome visible, and keep monetization as secondary transparency.

## Required Fixes Before Publishing Any Locale

Revise the locale if any of these appear:

* Screenshot 1 begins with diagnostic logs, technical settings, a file picker, library-only UI, privacy-only claim, or monetization.
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

## Final Conclusion

The localized EPUB Fixer direction is approved when it preserves the app’s actual repair scope and tells a believable recovery story.

The strongest global conversion path is:

EPUB not working correctly → safe session → clear diagnosis → supported repair → visible repair summary → safe repaired copy → local control.

The strongest global visual strategy is:

The same EPUB shown in two clear states:

Problem detected
→
Repaired copy ready

The strongest global trust proof is:

File repair is processed on the device. No accounts. No uploads. The original EPUB remains unchanged.

The strongest product-completeness proof is:

Repaired and imported files can be found again in My EPUBs, while language, theme, and remove-ads options remain secondary support features.

Future generated fichas should use this audit as an active QA checklist, not only as a summary document.
