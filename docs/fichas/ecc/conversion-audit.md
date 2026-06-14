# ECC Conversion Audit

## Purpose

Audit the conversion readiness, product truth, trust proof, and unsupported-claim risk of each localized Play Store listing for EPUB Cover Changer.

This audit verifies that each locale keeps the same real product promise:

Change or fix the cover of an EPUB file using a custom image, with local processing, no accounts, no uploads, preview, and save-as-copy behavior.

The audit should be used after generating localized fichas and before creating or publishing Play Store visual assets.

## Global Conversion Standard

Every locale must preserve this hierarchy:

1. Clear problem
2. Fast EPUB cover change
3. Simple workflow
4. Cover layout control
5. Local/private processing
6. Safe result / new copy
7. No unsupported promises

The first visual impact must show a before/after transformation or a final improved EPUB cover. It must not open with settings, a technical screen, an empty library, or a generic editor interface.

## Locale Audit Table

| Locale | Aprobado | Prueba de confianza                                         | Hero statement                                  | Risk check                                                             |
| ------ | -------- | ----------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| en-US  | Sí       | 100% on device. No accounts. No uploads.                    | Change the cover of any EPUB file in seconds    | Avoid making it look like a generic image editor or AI cover generator |
| es-MX  | Sí       | 100% en tu dispositivo. Sin cuentas. Sin subir archivos.    | Cambia la portada de cualquier EPUB en segundos | Evitar abrir con editor genérico, ajustes o biblioteca sola            |
| de-DE  | Sí       | Lokale Verarbeitung. Kein Konto. Kein Upload.               | EPUB-Cover schnell ersetzen oder korrigieren    | Evitar prometer edición completa de EPUB o compatibilidad absoluta     |
| fr-FR  | Sí       | Traitement local. Aucun compte. Aucun envoi.                | Remplacer une couverture EPUB facilement        | Evitar parecer una app artística antes de explicar la utilidad         |
| it-IT  | Sí       | Tutto sul dispositivo. Nessun account. Nessun upload.       | Cambia o sistema la copertina EPUB rapidamente  | Evitar que parezca un editor de imágenes genérico                      |
| pt-BR  | Sí       | 100% no dispositivo. Sem conta. Sem uploads.                | Troque a capa de um EPUB em segundos            | Evitar prometer edição completa de EPUB, IA ou templates               |
| ar-SA  | Sí       | تتم المعالجة على الجهاز. بدون حساب. بدون رفع ملفات.         | تغيير غلاف EPUB بسرعة وسهولة                    | تجنب الزخرفة الزائدة أو وعود الذكاء الاصطناعي                          |
| hi-IN  | Sí       | On-device processing. No account. No uploads.               | Change or fix an EPUB cover quickly             | Avoid complex technical language or UI-first opening                   |
| ja-JP  | Sí       | 端末上で処理。アカウント不要。アップロード不要。                                    | EPUB表紙をすばやく差し替え                                 | 技術説明、派手な装飾、AI生成の誤解を避ける                                                 |
| ko-KR  | Sí       | 기기에서만 처리. 계정 없음. 업로드 없음.                                    | EPUB 표지를 빠르게 교체                                 | 일반 이미지 편집기처럼 보이지 않게 하기                                                 |
| ru-RU  | Sí       | Обработка на устройстве. Без аккаунта. Без загрузки файлов. | Быстро заменить обложку EPUB                    | Не обещать полный EPUB-редактор, DRM или облачный сервис               |
| zh-CN  | Sí       | 本地处理。无需账号。不上传文件。                                            | 快速更换 EPUB 封面                                    | 避免暗示完整 EPUB 编辑、AI 生成或云端处理                                              |
| zh-TW  | Sí       | 在裝置上處理。無需帳號。不需上傳。                                           | 快速更換 EPUB 封面                                    | 避免看起來像一般圖片編輯器或雲端服務                                                     |

## Scoring Criteria

Use this section to evaluate each generated ficha and visual set.

Score each area from 1 to 5.

| Criterion                  | Target                                                                                | Failure signal                                                         |
| -------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| App name clarity           | User understands EPUB cover replacement immediately                                   | Sounds like full EPUB editor, ebook reader, or generic library manager |
| Short description strength | Clear benefit + EPUB cover keyword                                                    | Too vague, too aesthetic, or missing EPUB/cover intent                 |
| Long description clarity   | Practical, direct, conversion-focused                                                 | Too short, poetic, technical, or keyword-stuffed                       |
| Screenshot 1 hook          | Shows pain point or before/after transformation                                       | Starts with editor, settings, empty library, or abstract visuals       |
| Before/after clarity       | Transformation is obvious at a glance                                                 | Before and after look too similar or require explanation               |
| Workflow clarity           | User sees select → adjust → preview/save                                              | Flow feels complex or generic                                          |
| Privacy/trust proof        | On-device, no account, no upload are visible                                          | Trust proof hidden or absent                                           |
| Safe-copy reassurance      | User understands original is not silently overwritten                                 | Export/save behavior feels risky or unclear                            |
| Visual specificity         | Asset instructions define palette, safe area, accent, texture, and forbidden elements | Background instructions are vague or leave copy readability to chance  |
| Unsupported claim risk     | No AI, DRM, full EPUB editing, official platform, download, or cloud claims           | Listing implies features outside the app’s real scope                  |

## Recommended Passing Threshold

A locale should be considered approved only if:

* Average score is 4.0 or higher.
* Screenshot 1 hook score is 4 or higher.
* Unsupported claim risk score is 5.
* Privacy/trust proof score is 4 or higher.
* Before/after clarity score is 4 or higher.

If unsupported claim risk is below 5, the locale should be revised before publishing.

## Locale Notes

### en-US

Conversion angle:
Fast, practical EPUB cover replacement with strong privacy and utility-tech trust.

Most important proof:
100% on device. No accounts. No uploads.

Visual priority:
Before/after transformation with a clean, premium charcoal + slate navy + steel blue system.

Main risk:
Looking like a generic image editor or AI cover generator.

### es-MX

Conversion angle:
Fix a cover that “no te convence” quickly and without complications.

Most important proof:
100% en tu dispositivo. Sin cuentas. Sin subir archivos.

Visual priority:
Direct problem-first screenshot, natural Spanish copy, strong before/after contrast.

Main risk:
Opening with the editor, settings, or file library before showing the transformation.

### de-DE

Conversion angle:
Precise, reliable EPUB cover correction with local processing.

Most important proof:
Lokale Verarbeitung. Kein Konto. Kein Upload.

Visual priority:
Clear utility, controlled layout, no exaggerated emotional language.

Main risk:
Overpromising full EPUB editing, universal compatibility, or technical functionality.

### fr-FR

Conversion angle:
Simple replacement of an EPUB cover, with enough polish to feel elegant but still practical.

Most important proof:
Traitement local. Aucun compte. Aucun envoi.

Visual priority:
Readable, refined, not overly decorative.

Main risk:
Looking like an artistic cover-design app before the actual utility is clear.

### it-IT

Conversion angle:
Quickly change or fix an EPUB cover with a simple and private flow.

Most important proof:
Tutto sul dispositivo. Nessun account. Nessun upload.

Visual priority:
Simple, direct, warm enough to feel approachable but still utility-first.

Main risk:
Looking like a generic image editor.

### pt-BR

Conversion angle:
Trocar a capa de um EPUB em segundos, with simple adjustment and local privacy.

Most important proof:
100% no dispositivo. Sem conta. Sem uploads.

Visual priority:
Clear transformation, strong headline, simple flow.

Main risk:
Promising full EPUB editing, AI generation, or templates.

### ar-SA

Conversion angle:
Fast and simple EPUB cover change, with privacy and no upload.

Most important proof:
تتم المعالجة على الجهاز. بدون حساب. بدون رفع ملفات.

Visual priority:
RTL-safe composition, clean text area, restrained decoration.

Main risk:
Over-decoration, unclear transformation, or AI-generation implications.

### hi-IN

Conversion angle:
Change or fix an EPUB cover quickly, with a simple mobile workflow.

Most important proof:
On-device processing. No account. No uploads.

Visual priority:
Simple English or localized copy depending on final Hindi strategy, direct transformation, no technical clutter.

Main risk:
Complex technical language or opening with UI instead of the result.

### ja-JP

Conversion angle:
Quickly replace an EPUB cover with a clean, practical, privacy-safe workflow.

Most important proof:
端末上で処理。アカウント不要。アップロード不要。

Visual priority:
Minimal, clean, precise, not flashy.

Main risk:
Too much technical explanation, excessive decoration, or AI-generation misunderstanding.

### ko-KR

Conversion angle:
Fast EPUB cover replacement with a modern, clean, practical workflow.

Most important proof:
기기에서만 처리. 계정 없음. 업로드 없음.

Visual priority:
Tech-premium, clean UI proof, restrained color.

Main risk:
Looking like a general image editing app.

### ru-RU

Conversion angle:
Quick EPUB cover replacement with local processing and no account.

Most important proof:
Обработка на устройстве. Без аккаунта. Без загрузки файлов.

Visual priority:
Practical, direct, serious, with strong privacy proof.

Main risk:
Implying full EPUB editing, DRM support, cloud service, or online processing.

### zh-CN

Conversion angle:
Fast local EPUB cover replacement with no account and no upload.

Most important proof:
本地处理。无需账号。不上传文件。

Visual priority:
Clean, efficient, utility-first, with clear before/after proof.

Main risk:
Implying complete EPUB editing, AI generation, or cloud processing.

### zh-TW

Conversion angle:
Quickly replace an EPUB cover with a private, simple, local workflow.

Most important proof:
在裝置上處理。無需帳號。不需上傳。

Visual priority:
Clean trust-oriented UI, clear transformation, polished but not overdesigned.

Main risk:
Looking like a generic image editor or cloud service.

## Global Findings

All approved variants maintain the same real product identity:

The app replaces the cover of an EPUB file using an image chosen by the user.

The conversion hierarchy is aligned:

Problem → fast change → layout control → local privacy → safe copy.

No locale should introduce claims about:

* AI generation
* automatic cover generation
* template marketplaces
* DRM removal
* full EPUB editing
* EPUB text editing
* ebook downloads
* free books
* official reading-platform affiliation
* cloud processing
* universal reader compatibility

The main trust proof is consistent across locales:

Processing happens on the device, with no accounts and no uploads.

The first visual impact must show a before/after EPUB cover transformation.

The biggest global conversion risk is making the app look like a generic image editor. To avoid this, every locale must open with the result: changing or fixing an EPUB cover.

## Required Fixes Before Publishing Any Locale

Revise the locale if any of these appear:

* Screenshot 1 starts with editor controls instead of before/after or final result.
* Copy says or implies “AI cover generator.”
* Copy implies support for DRM-protected EPUBs.
* Copy implies full EPUB editing.
* Copy implies the app downloads or provides books.
* Copy implies official affiliation with Kindle, Kobo, Adobe, Apple Books, Google Play Books, or any ebook platform.
* Visuals resemble PDF documents instead of EPUB/book covers.
* Trust proof is missing from the long description or screenshots.
* Before/after covers are not clearly different.
* Text readability is weak due to glow, gradients, or bright areas behind the headline.

## Final Conclusion

The localized ECC direction is approved.

All variants preserve the same product truth: replace the cover of an EPUB file with a user-selected image, adjust it, preview it, and save a new copy.

The strongest global conversion path is:

Bad or incorrect cover → quick replacement → precise adjustment → private local processing → safer saved copy.

The strongest global visual strategy is:

A weak/plain EPUB cover transformed into a polished, desirable cover.

The strongest global trust proof is:

100% on-device processing, no accounts, and no uploads.

Future generated fichas should keep this audit as a QA checklist, not just as a summary table.
