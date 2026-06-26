# EPUB Fixer Conversion Audit

## Purpose

Audit the conversion readiness, product truth, repair-scope accuracy, trust proof, and unsupported-claim risk of each localized Play Store listing for EPUB Fixer.

This audit verifies that every locale preserves the same real product promise:

Diagnose common supported EPUB structure issues, repair what the app can handle, explain the result, and save a repaired EPUB as a new copy.

The audit should be used after generating localized fichas and before creating, approving, or publishing Play Store visual assets.

## Global Conversion Standard

Every locale must preserve this hierarchy:

1. Recognizable EPUB problem
2. Clear diagnosis
3. Supported repair
4. Visible repair result
5. Safe new-copy output
6. Local/private processing
7. No unsupported promises

The first visual impact must show a recovery story:

Problem EPUB → repaired EPUB copy

It must not open with settings, a technical report, raw XML, a file picker, an empty library, an abstract privacy claim, or a generic utility interface.

The listing must never make the app appear to repair every possible EPUB or recover book content that is genuinely missing.

## Required Product Truth

Every approved locale must communicate only the repair scope supported by the current build.

Safe high-level promise:

* Diagnose common EPUB issues
* Repair supported EPUB structure problems
* Create a repaired EPUB copy
* Keep the original unchanged
* Process files on-device
* Require no account
* Avoid uploads

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
* Rebuilding a corrected EPUB after supported changes

Do not present these as universal guarantees. Use phrasing such as:

* Finds common supported issues
* Repairs compatible structure problems
* Fixes supported EPUB errors
* Creates a repaired copy when possible

Avoid phrasing such as:

* Fix any EPUB
* Repair all corrupted books
* Restore damaged book content
* Guaranteed EPUB recovery
* Fix every ebook error
* Make any EPUB work everywhere

## Locale Audit Table

| Locale | Aprobado | Prueba de confianza                                                                 | Hero statement                                                | Risk check                                                                                          |
| ------ | -------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| en-US  | Sí       | 100% on device. No accounts. No uploads. Original unchanged.                        | Fix common EPUB file issues and save a repaired copy          | Avoid universal-repair language, antivirus styling, or overly technical XML-first visuals           |
| es-MX  | Sí       | 100% en tu dispositivo. Sin cuentas. Sin subir archivos. El original no cambia.     | Repara problemas comunes en EPUB y guarda una copia corregida | Evitar prometer que cualquier EPUB dañado se puede recuperar o abrir con una pantalla técnica       |
| de-DE  | Sí       | Lokale Verarbeitung. Kein Konto. Kein Upload. Original bleibt erhalten.             | Häufige EPUB-Probleme prüfen und reparierte Kopie speichern   | Evitar claims absolutos, lenguaje ambiguo de recuperación total o estética de limpiador de archivos |
| fr-FR  | Sí       | Traitement local. Aucun compte. Aucun envoi. Original conservé.                     | Diagnostiquer et corriger les problèmes EPUB courants         | Evitar que parezca una herramienta técnica compleja o un servicio de conversión online              |
| it-IT  | Sí       | Tutto sul dispositivo. Nessun account. Nessun upload. Originale invariato.          | Trova e correggi i problemi EPUB più comuni                   | Evitar apariencia de antivirus, promesas de reparación completa o tecnicismos excesivos             |
| pt-BR  | Sí       | 100% no dispositivo. Sem conta. Sem uploads. Original preservado.                   | Corrija problemas comuns em EPUB e salve uma cópia reparada   | Evitar promesas de reparar qualquer EPUB ou estilo de aplicativo de limpeza genérico                |
| ar-SA  | Sí       | تتم المعالجة على الجهاز. بدون حساب. بدون رفع ملفات. يبقى الأصل دون تغيير.           | اكتشف مشكلات EPUB الشائعة وأصلح الملفات المدعومة              | تجنب promesas absolutas, exceso de detalles técnicos y composiciones no seguras para RTL            |
| hi-IN  | Sí       | On-device processing. No account. No uploads. Original stays unchanged.             | Diagnose and repair common EPUB issues                        | Avoid jargon-heavy copy, technical-first screens, and generic file-cleaner positioning              |
| ja-JP  | Sí       | 端末上で処理。アカウント不要。アップロード不要。元のファイルはそのまま。                                                | EPUBの一般的な問題を確認して修復コピーを保存                                      | 避免使用夸张的修复承诺、复杂技术说明或醒目的错误视觉                                                                          |
| ko-KR  | Sí       | 기기에서만 처리. 계정 없음. 업로드 없음. 원본은 그대로 유지.                                                | 일반적인 EPUB 문제를 진단하고 복구 사본 저장                                   | 일반 파일 정리 앱처럼 보이거나 모든 오류를 고친다고 암시하지 않기                                                               |
| ru-RU  | Sí       | Обработка на устройстве. Без аккаунта. Без загрузки файлов. Оригинал не изменяется. | Найдите и исправьте распространённые проблемы EPUB            | Не обещать полное восстановление, поддержку DRM или универсальную совместимость                     |
| zh-CN  | Sí       | 本地处理。无需账号。不上传文件。原文件不变。                                                              | 检查常见 EPUB 问题并保存修复副本                                           | 避免暗示可修复所有损坏文件、云端处理或完整 EPUB 编辑                                                                       |
| zh-TW  | Sí       | 在裝置上處理。無需帳號。不需上傳。原始檔案不會變更。                                                          | 檢查常見 EPUB 問題並儲存修復副本                                           | 避免看起來像防毒、檔案清理工具或保證修復所有 EPUB                                                                         |

## Scoring Criteria

Score each area from 1 to 5.

| Criterion                  | Target                                                                                               | Failure signal                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| App name clarity           | User understands this is an EPUB repair utility                                                      | Sounds like a generic file fixer, full EPUB editor, reader, antivirus, or universal recovery tool |
| Short description strength | Clear repair benefit plus EPUB keyword                                                               | Too vague, too technical, or promises guaranteed repair                                           |
| Long description clarity   | Practical, accurate, focused on diagnosis → repair → copy                                            | Too shallow, keyword-stuffed, overly technical, or misleading about repair scope                  |
| Screenshot 1 hook          | Recognizable EPUB problem and repaired outcome                                                       | Starts with settings, technical report, picker, empty library, or abstract trust claim            |
| Problem-to-repair clarity  | The relationship between original and repaired EPUB is obvious                                       | Issue and repaired state look too similar or need long explanation                                |
| Diagnosis clarity          | Users understand the app checks what is wrong before repair                                          | Raw XML, cryptic logs, unexplained error codes, or no diagnostic proof                            |
| Repair workflow clarity    | Shows repair of supported issues in an understandable way                                            | Looks magical, vague, generic, or implies every issue can be fixed                                |
| Repair-result proof        | User can see what was repaired or changed                                                            | No summary, vague “success” state, or claims not tied to actual engine behavior                   |
| Safe-copy reassurance      | User understands the original EPUB remains unchanged                                                 | Save flow feels like overwrite, deletion, or destructive modification                             |
| Privacy/trust proof        | On-device, no account, and no upload are visible                                                     | Trust proof absent, hidden, or replaced with cloud language                                       |
| Visual specificity         | Asset instructions define palette, safe area, accent, texture, and forbidden elements                | Background direction is vague or risks unreadable copy                                            |
| Unsupported claim risk     | No universal repair, DRM, content recovery, AI, cloud, editor, download, or official-platform claims | Any copy or visual implies functionality outside the app’s real scope                             |

## Recommended Passing Threshold

A locale should be considered approved only if:

* Average score is 4.0 or higher.
* Screenshot 1 hook score is 4 or higher.
* Problem-to-repair clarity score is 4 or higher.
* Diagnosis clarity score is 4 or higher.
* Safe-copy reassurance score is 4 or higher.
* Privacy/trust proof score is 4 or higher.
* Unsupported claim risk score is 5.

If unsupported claim risk is below 5, the locale must be revised before publishing.

If the repair-result proof score is below 4, the visual sequence must be revised before production.

## Mandatory Claim Validation Before Asset Production

Before generating a screenshot, feature graphic, or listing copy that names a repair action, validate it against the current repair engine.

Use this checklist:

| Proposed visual or copy claim | Verify before use                                                          |
| ----------------------------- | -------------------------------------------------------------------------- |
| “Fixed missing mimetype”      | The app truly detects and repairs invalid or missing `mimetype`            |
| “Rebuilt package structure”   | The app reconstructs the supported package structure in the current build  |
| “Fixed container file”        | The app can handle missing or unreadable `META-INF/container.xml`          |
| “Fixed content file”          | The app can handle missing or unreadable `content.opf`                     |
| “Removed broken references”   | The repair engine actually removes or corrects broken manifest references  |
| “Fixed spine entries”         | The app truly detects and corrects invalid or empty spine entries          |
| “Repaired EPUB”               | The result is a newly generated EPUB file, not only a diagnostic report    |
| “Original unchanged”          | The app saves a separate file and does not silently overwrite source input |
| “No uploads”                  | No file content is sent to cloud or third-party services                   |
| “Works on your device”        | Repair processing is performed locally in the app                          |

If a repair is uncertain, use broader but accurate wording:

* Issue found
* Supported problem detected
* Repair applied where possible
* Repaired copy created
* Review the result before saving

## Locale Notes

### en-US

Conversion angle:

A practical solution for EPUB files that do not open or behave correctly.

Most important proof:

Clear diagnosis before repair, followed by a repaired-copy result.

Visual priority:

Broken EPUB → diagnosis → repaired EPUB copy, using a capable charcoal utility aesthetic with controlled recovery-red or calm slate-blue emphasis.

Main risk:

Overpromising universal recovery, looking like a generic antivirus, or presenting technical internals before the user understands the result.

### es-MX

Conversion angle:

“¿Tu EPUB no abre bien?” followed by a simple, understandable path toward a repaired copy.

Most important proof:

La app explica qué falló, aplica correcciones compatibles y no modifica el archivo original.

Visual priority:

Problema visible → diagnóstico claro → copia reparada, con lenguaje directo y sin intimidar al usuario con términos técnicos.

Main risk:

Prometer que cualquier EPUB dañado puede repararse, usar lenguaje demasiado técnico o abrir la ficha con una pantalla de diagnóstico sin contexto.

### de-DE

Conversion angle:

Precise EPUB diagnosis and controlled repair of supported file issues.

Most important proof:

Local processing, clear findings, and an unchanged original file.

Visual priority:

Structured, restrained, exact, utility-first visual language.

Main risk:

Exaggerated emotional wording, vague “magic repair” language, universal compatibility claims, or cluttered visual composition.

### fr-FR

Conversion angle:

Simple and clear EPUB recovery with a transparent diagnostic process.

Most important proof:

Local treatment, concise repair explanation, and a safe separate copy.

Visual priority:

Refined but practical layouts with clear progress from problem to repaired result.

Main risk:

Making the product feel like a technical desktop utility, a cloud service, or an opaque automatic repair process.

### it-IT

Conversion angle:

Repair common EPUB problems quickly while keeping the original file safe.

Most important proof:

A visible repair summary and local processing.

Visual priority:

Accessible, direct, polished utility visuals with a clear before-and-after story.

Main risk:

Looking like a general file-cleaning app or making claims about complete ebook restoration.

### pt-BR

Conversion angle:

Find common EPUB issues, repair compatible problems, and save a new corrected copy.

Most important proof:

On-device processing and original-file preservation.

Visual priority:

Strong recovery transformation, readable status labels, and simple workflow proof.

Main risk:

Promises around repairing any damaged EPUB, cloud storage, or generic device-cleaner styling.

### ar-SA

Conversion angle:

Clear, private EPUB diagnosis and supported repair with a safe new copy.

Most important proof:

Original remains unchanged, no upload, and repair results are explained.

Visual priority:

RTL-safe hierarchy, generous copy-safe area, concise text, and controlled visual emphasis.

Main risk:

Overloaded text, insufficient RTL adaptation, excessive decoration, or claims that imply guaranteed recovery.

### hi-IN

Conversion angle:

A straightforward mobile utility for finding and repairing common EPUB file issues.

Most important proof:

Diagnosis before repair, local processing, and a separate repaired file.

Visual priority:

Clear English or localized messaging, short copy, and obvious recovery state.

Main risk:

Complex technical terms, too much diagnostic detail, or generic file-tool positioning.

### ja-JP

Conversion angle:

A precise and minimal way to inspect EPUB issues and save a repaired copy.

Most important proof:

Transparent local handling and original preservation.

Visual priority:

Minimal, orderly, quiet confidence; the file-state transformation should carry the message.

Main risk:

Aggressive warning visuals, lengthy technical terminology, or making the app appear unreliable through overly dramatic error imagery.

### ko-KR

Conversion angle:

A modern, practical EPUB recovery workflow: diagnose, repair compatible issues, and save a separate result.

Most important proof:

Real repair-result screen plus fully local processing.

Visual priority:

Clean UI proof, restrained color, and concise status language.

Main risk:

Looking like a general file-management app, an antivirus, or a tool that promises to repair all files.

### ru-RU

Conversion angle:

Practical EPUB troubleshooting and repair with visible results and local privacy.

Most important proof:

Clear diagnosis, repaired-copy output, and original-file preservation.

Visual priority:

Serious, direct, utility-first presentation.

Main risk:

Implying full EPUB editing, DRM support, cloud processing, or guaranteed recovery.

### zh-CN

Conversion angle:

Fast, local diagnosis and repair of common EPUB issues with a separate saved copy.

Most important proof:

Local-only processing, no account, no upload, and original file unchanged.

Visual priority:

Efficient, clean, utility-first composition with a clear issue-to-repair transition.

Main risk:

Implying complete EPUB editing, cloud repair, AI processing, or universal recovery capability.

### zh-TW

Conversion angle:

A clear local workflow for checking EPUB problems and saving a repaired version.

Most important proof:

Transparent repair result and preserved original.

Visual priority:

Polished, trust-oriented, concise visual language with strong recovery proof.

Main risk:

Looking like a cloud file service, a generic cleanup app, or a tool that guarantees every EPUB can be fixed.

## Global Findings

All approved variants must maintain the same real product identity:

The app diagnoses common supported EPUB problems, repairs compatible structural issues, and creates a separate repaired EPUB copy.

The conversion hierarchy is aligned:

Problem → diagnosis → repair → proof → safe copy → privacy.

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

The main trust proof is consistent across locales:

Files are processed on the device, no account is required, no upload is needed, and the original EPUB remains unchanged.

The first visual impact must show a clear recovery transformation.

The largest global conversion risk is making EPUB Fixer look like either a generic file cleaner or a universal recovery tool.

To avoid this, every locale must lead with a realistic EPUB-specific problem, show diagnosis before repair, and make the repaired-copy outcome visible.

## Required Fixes Before Publishing Any Locale

Revise the locale if any of these appear:

* Screenshot 1 begins with diagnostic logs, technical settings, a file picker, or library-only UI.
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

## Final Conclusion

The localized EPUB Fixer direction is approved when it preserves the app’s actual repair scope and tells a believable recovery story.

The strongest global conversion path is:

EPUB not working correctly → clear diagnosis → supported repair → visible repair summary → safe repaired copy → local privacy.

The strongest global visual strategy is:

The same EPUB shown in two clear states:

Problem detected
→
Repaired copy ready

The strongest global trust proof is:

Everything is processed on the device. No accounts. No uploads. The original EPUB remains unchanged.

Future generated fichas should use this audit as an active QA checklist, not only as a summary document.
