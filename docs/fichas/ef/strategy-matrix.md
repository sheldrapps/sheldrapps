# EPUB Fixer Strategy Matrix

## Purpose

Define the regional conversion strategy for EPUB Fixer across all supported Play Store locales.

This matrix guides:

* localized Play Store fichas
* feature graphics
* screenshots
* visual direction
* palette selection
* conversion audits
* bulk asset generation

The product truth must remain consistent across all locales:

**EPUB Fixer helps users select an EPUB from the device, check whether it is really a valid EPUB, diagnose common supported EPUB structure issues, repair compatible problems, and save a repaired EPUB as a new copy without changing the original file.**

The product may also communicate, as secondary product completeness:

* My EPUBs for repaired or imported files
* language and theme settings
* remove-ads option
* rewarded-ad access for some free repairs
* fallback handling if an ad cannot load
* clear handling for files that are not real EPUBs

---

## Global Strategy

The approved compact conversion journey is:

**EPUB with a problem → valid EPUB check → repairable diagnosis → repaired copy → local control**

The global screenshot set should stay compact:

1. Problem EPUB → repaired EPUB copy
2. Invalid-file / changed-extension case
3. Repairable diagnosis / structure issue found
4. Save a repaired copy / original unchanged
5. My EPUBs + local/private trust proof

The product must never be positioned as:

* a universal corrupted-file recovery tool
* an antivirus or phone cleaner
* a full EPUB editor
* a reader or ebook store
* a cloud conversion service
* an AI repair product
* a DRM-related tool
* a guarantee that every EPUB can be repaired
* an ad-first or paywall-first product

The first visual proof must always show an understandable recovery outcome, not only a technical process.

The invalid-file case is no longer optional. It is part of the core compact strategy because it helps users understand when a file only has an `.epub` extension but is not actually repairable as an EPUB.

---

# Strategy Matrix

| Locale | Market angle                                                               | Hero visual                                                               | Invalid-file visual                                                                       | Repairable diagnosis emphasis                                                             | Repaired-copy proof                                                 | Local / privacy trust proof                                                                          | Monetization handling                                                                                   | What to avoid                                                                                                                                           | Background base | Background secondary | Accent color | Support accent | Title color | Subline color | Bullet color | Notes                                                                                                           |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | ------------ | -------------- | ----------- | ------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| en-US  | Fast, practical EPUB repair for files that do not open or behave correctly | Same EPUB shown as “Can’t open correctly” and “Repaired copy ready”       | Clear “Not a valid EPUB” state; explain changed extension without drama                   | Show 2–3 concise structure findings before repair, such as OPF, manifest, or spine issues | Distinct repaired-copy filename and original unchanged message      | On-device file processing. No accounts. No uploads. Original unchanged.                              | Mention remove ads only as secondary transparency. Rewarded ads should not appear in early screenshots. | Universal-repair claims, antivirus visuals, XML-first opening, full-editor language, cloud claims, “100% offline” if ads may load                       | `#151515`       | `#252525`            | `#B3261E`    | `#D4574F`      | `#FFFFFF`   | `#D9D9D9`     | `#E3C3C1`    | Lead with urgency and recovery. Use “IS IT REALLY AN EPUB?” as a strong second screenshot hook.                 |
| es-MX  | Recuperar un EPUB que no abre bien, sin complicaciones                     | Problema visible → copia reparada con mensaje claro                       | Estado claro de “No es un EPUB válido”; explicar extensión cambiada sin llamarlo “dañado” | “Entiende qué falló” antes de reparar; evitar jerga en el titular                         | Copia reparada lista, con el original intacto                       | Procesamiento del archivo en tu dispositivo. Sin cuentas. Sin subir archivos. El original no cambia. | Quitar anuncios puede aparecer en ajustes o cierre. No vender anuncios recompensados como beneficio.    | Lenguaje demasiado técnico, reparación garantizada, estética de antivirus, diagnóstico como primera imagen, “100% offline” en flujo gratis con anuncios | `#151515`       | `#252525`            | `#B3261E`    | `#D4574F`      | `#FFFFFF`   | `#D9D9D9`     | `#E3C3C1`    | “¿Tu EPUB no abre bien?” sigue siendo el hook más fuerte. “¿Es realmente un EPUB?” debe ser la segunda captura. |
| de-DE  | Precise EPUB validation and controlled repair of compatible issues         | Restrained before/after: issue detected → repaired copy                   | Calm invalid-file explanation; avoid emotional failure language                           | Structured findings, clear and minimal, with high trust in exactness                      | Separate repaired copy with “original remains unchanged” equivalent | Lokale Dateiverarbeitung. Kein Konto. Kein Upload. Original bleibt erhalten.                         | Werbefreie Option nur sachlich und in final/secondary contexts.                                         | Emotional wording, vague magic repair, universal compatibility, clutter, unverified offline claims                                                      | `#121416`       | `#202326`            | `#7A8FA6`    | `#9FB2C5`      | `#F7F7F7`   | `#C9D0D4`     | `#DCE3EA`    | Prioritize precision and control. A slate-blue technical palette may outperform repair-red.                     |
| fr-FR  | Récupération EPUB simple, claire et transparente                           | Elegant progression: problème détecté → copie réparée                     | Explain invalid EPUB / changed extension with editorial calm                              | Human-readable diagnosis before technical details                                         | Repaired copy confirmation should feel verifiable, not abstract     | Traitement du fichier sur l’appareil. Aucun compte. Aucun envoi. Original conservé.                  | Option sans publicité as support, not the main claim.                                                   | Hostile technical feel, cloud language, opaque automation, dense copy, paywall-first visuals                                                            | `#151518`       | `#242126`            | `#9E5A52`    | `#C98C84`      | `#FFFFFF`   | `#DDD4DC`     | `#EAB4AD`    | Balance editorial polish with concrete utility. Keep invalid-file language calm and explanatory.                |
| it-IT  | Correggere problemi EPUB comuni in modo semplice e sicuro                  | Warm but clear before/after with the same EPUB card                       | Show file extension mismatch without using dramatic error styling                         | Accessible “what was found” structure explanation                                         | New repaired copy with visible confirmation                         | Elaborazione del file sul dispositivo. Nessun account. Nessun upload. Originale invariato.           | Rimuovi annunci can appear as secondary settings polish.                                                | File-cleaner aesthetic, excessive jargon, promises to recover all book content                                                                          | `#181414`       | `#2B2320`            | `#C85A3E`    | `#E08A65`      | `#FFFFFF`   | `#E8D4CA`     | `#F0B69E`    | Can be warmer, but must remain utility-first. Avoid making repair feel magical.                                 |
| pt-BR  | Corrigir EPUB com problema e salvar uma cópia reparada                     | Direct transformation: EPUB com problema → EPUB corrigido                 | Clear “not a valid EPUB” state; explain changed extension simply                          | Simple diagnosis before repair action                                                     | Same file shown as repaired copy, original preserved                | Processamento do arquivo no dispositivo. Sem conta. Sem uploads. Original preservado.                | Remover anúncios as final/secondary option. Avoid free-unlimited implications.                          | Promising repair of any EPUB, antivirus look, cloud service, generic cleaner, “100% offline” with ads                                                   | `#161313`       | `#2A2020`            | `#D94B35`    | `#F27A55`      | `#FFFFFF`   | `#F0D2CC`     | `#FFC0A6`    | Accent can be energetic, but the invalid-file case must remain calm.                                            |
| ar-SA  | Private EPUB validation and supported repair with a safe new copy          | RTL-safe comparison: problem state → repaired copy, mirrored consistently | Clear invalid EPUB state in RTL layout with generous text space                           | Very concise diagnosis; avoid cramped technical lists                                     | Repaired copy separated from original, with clear status            | تتم معالجة الملف على الجهاز. بدون حساب. بدون رفع ملفات. يبقى الأصل دون تغيير.                        | Mention ad-free only in settings/final context. Rewarded ads must not crowd RTL layouts.                | LTR design, cramped text, excessive decoration, guaranteed recovery claims, cloud icons, dominant monetization                                          | `#101418`       | `#1C252B`            | `#B88A3A`    | `#E4C47A`      | `#FFFFFF`   | `#D7E0E3`     | `#E4C47A`    | Maintain premium, sober, RTL-safe composition. Bronze/gold works as controlled recovery emphasis.               |
| hi-IN  | Clear mobile solution for EPUB files that do not open or are not valid     | Simple visual comparison: problem EPUB and repaired copy                  | Straightforward invalid-file explanation; avoid too much technical English                | Short visual diagnosis, not code-heavy                                                    | Repaired-copy result with visible output filename                   | File processing on device. No account. No uploads. Original stays unchanged.                         | Keep monetization simple: remove ads as optional. Avoid rewarded ads in hero assets.                    | Technical jargon, UI-first screenshots, confusing Hindi/English mix, phone-cleaner look                                                                 | `#151515`       | `#252018`            | `#D96B2B`    | `#FFC48F`      | `#FFFFFF`   | `#EED8C6`     | `#FFC48F`    | Use very direct language. EPUB and repair terms may stay in English if that fits the final localization.        |
| ja-JP  | EPUBの問題を確認し、修復コピーを保存する精密なユーティリティ                                           | Minimal, calm transformation of the same EPUB                             | Quiet invalid-file explanation; avoid loud failure visuals                                | Concise, orderly diagnosis with minimal terms                                             | Repaired copy shown clearly and calmly                              | ファイルは端末上で処理。アカウント不要。アップロード不要。元のファイルはそのまま。                                                            | Ad-free option only as quiet settings detail.                                                           | Dramatic errors, heavy decoration, long technical terms, antivirus look, absolute promises                                                              | `#121416`       | `#1E2327`            | `#8F3A35`    | `#D49B96`      | `#F8F8F8`   | `#CDD5D8`     | `#D49B96`    | Prioritize calm, order, and precision. The visual transition should work without long copy.                     |
| ko-KR  | Common EPUB issue diagnosis with a safe repaired copy                      | Modern before/after with concise file states                              | Show invalid EPUB / changed extension clearly, not as a fatal error                       | Diagnose first, repair supported issue second                                             | Repaired copy visible with distinct filename                        | 파일은 기기에서 처리. 계정 없음. 업로드 없음. 원본은 그대로 유지.                                                              | Remove-ads as secondary product control. Avoid ad mechanics in early visuals.                           | Looking like a file explorer, antivirus, or tool that fixes every error                                                                                 | `#121417`       | `#1F2429`            | `#A83A32`    | `#DFA49D`      | `#FFFFFF`   | `#CDD6DC`     | `#DFA49D`    | Modern, technical, clean. The real UI must support the repair credibility.                                      |
| ru-RU  | Practical EPUB troubleshooting with compatible repair and local privacy    | Direct, serious before/after                                              | Explain invalid EPUB without implying total corruption                                    | Show findings and result without promising complete recovery                              | Repaired copy ready; original unchanged                             | Обработка файла на устройстве. Без аккаунта. Без загрузки файлов. Оригинал не изменяется.            | Mention ad-free as optional, not core conversion.                                                       | Total recovery promises, DRM, cloud, hacking-tool feel, full EPUB editor implication                                                                    | `#141414`       | `#202226`            | `#B13A32`    | `#E0A39C`      | `#FFFFFF`   | `#D2D6DA`     | `#E0A39C`    | Serious and capable. Use “compatible repairs” language strongly.                                                |
| zh-CN  | 检查常见 EPUB 问题并本地保存修复副本                                                      | Problem EPUB and repaired result clearly linked                           | Explain invalid EPUB / extension mismatch efficiently                                     | Emphasize check first, repair second; technical terms stay secondary                      | Same EPUB shown as repaired copy                                    | 文件在设备上处理。无需账号。不上传文件。原文件不变。                                                                           | Remove-ads should be a late settings detail.                                                            | Full EPUB editing, AI repair, cloud processing, universal repair, security-software visuals, unverified offline promises                                | `#111417`       | `#1D242A`            | `#C24130`    | `#EAA69C`      | `#FFFFFF`   | `#D4DDE1`     | `#EAA69C`    | Efficient, clear, result-first. Avoid putting internal structure terms in main headlines.                       |
| zh-TW  | 檢查常見 EPUB 問題並儲存修復副本                                                        | Trust-oriented problem → repaired-copy flow                               | Explain invalid EPUB / changed extension clearly and calmly                               | Communicate “understand first, then repair supported issues”                              | New repaired copy clearly marked                                    | 檔案在裝置上處理。無需帳號。不需上傳。原始檔案不會變更。                                                                         | Ad-free option supports trust only if late and factual.                                                 | Antivirus look, cloud file service, generic cleanup app, guaranteed repair, unverified offline claims                                                   | `#121416`       | `#20272C`            | `#C6533D`    | `#ECB0A1`      | `#FFFFFF`   | `#D6E0E3`     | `#ECB0A1`    | Slightly editorial and warm is fine, but the result must feel technically credible.                             |

---

## Visual Generation Rules

Do not reuse the exact same palette across all locales.

Keep a dark global identity, but localize:

* accent temperature
* intensity of the repair marker
* headline directness
* invalid-file phrasing
* repairable-diagnosis detail level
* trust-proof priority
* visual warmth
* file-state wording
* public-domain title or neutral EPUB thumbnail style
* monetization visibility

`Background base` is the main canvas color.

`Background secondary` is used for:

* soft depth
* cards
* subtle gradients
* mockup shadows
* controlled contrast behind phone frames
* low-intensity visual separation between original and repaired states

`Accent color` is used for:

* issue markers
* repair-status indicators
* thin problem-to-repair connectors
* valid/invalid file-state badges
* progress or result highlights
* small visual cues on real app screens
* restrained emphasis around the repaired copy

`Support accent` is used only as a softer secondary highlight. It must not dominate the scene or compete with the repaired EPUB result.

---

## Background Production Rules

Every generated ficha must define:

* dimension
* base color
* secondary color
* accent color
* accent placement
* safe area for copy
* allowed texture
* forbidden elements behind text

The copy zone must stay dark, stable, and readable.

Do not place bright panels behind title text.

Do not use full red error screens, giant warning symbols, aggressive gradients, or dramatic light bursts behind the headline.

Do not use dense technical patterns, code, XML, or file-tree visuals as a background texture.

Do not place white document pages, device highlights, or bright repaired-file cards behind headline or subline copy.

Texture is allowed only if subtle and matte, under approximately 3% visual intensity.

---

## Screenshot Strategy Rules

The approved compact screenshot sequence should follow:

1. **Problem EPUB → repaired EPUB copy**
2. **Invalid-file / changed-extension case**
3. **Repairable diagnosis: what was found**
4. **Save a repaired copy: original unchanged**
5. **Local processing / My EPUBs / no-account and no-upload proof**

At least two visual assets must clearly show either:

* a problem EPUB transformed into a repaired EPUB copy, or
* a final repair result with the same EPUB title, thumbnail, and visible output filename.

The first screenshot must be understandable in one glance at Play Store preview size.

Do not open with:

* settings
* empty library
* app menu
* file picker without context
* raw technical report
* XML or code
* dense repair logs
* cloud/privacy claim without repair context
* monetization or rewarded-ad screen
* generic phone-cleaner screen
* abstract error art

### Expanded screenshot sets

Screenshots 6–8 may be added only when a full product set is needed or when a specific test requires more depth.

If used, extra screenshots must add distinct value, such as:

* settings / language / theme
* remove-ads option
* fuller My EPUBs view
* extra repair-result proof

They must not simply repeat:

* repair action
* repair complete
* repair summary
* save copy

---

## Feature Graphic Rules

The feature graphic must summarize the product in one glance.

It should communicate:

* EPUB problem detection
* repair of supported issues
* same EPUB before and after
* a new repaired copy
* speed and simple workflow
* local processing as secondary proof

It must not communicate:

* generic document repair
* PDF repair
* antivirus or malware cleaning
* hacker or terminal aesthetic
* AI repair
* cloud conversion
* ebook reading
* ebook downloads
* DRM removal
* full EPUB editing
* guaranteed recovery
* monetization as the core product

Recommended structure:

* headline in a stable dark safe area
* EPUB with a restrained issue marker on one side
* matching EPUB repair result on the other
* a thin connector or directional relationship between both states
* subtle accent near the repaired output
* optional compact trust proof below the headline
* no visual intensity behind text

---

## EPUB Thumbnail and File-State Rules

Preferred problem-state ideas:

* neutral EPUB card with “Issue found”
* same title shown with “Can’t open correctly”
* package or structure status shown in simple language
* small diagnostic badge, not a giant warning
* incomplete or unreadable internal-reference indication, only if understandable
* file name that looks realistic but remains readable

Preferred repaired-state ideas:

* same book title and thumbnail
* visible repaired-copy filename
* small clean confirmation marker
* labels such as “Repaired copy ready” or the local equivalent
* original and output shown separately when the screen supports it
* visual confirmation that the original remains available

Preferred invalid-file handling:

* use as screenshot 2 in the compact set
* use calm explanatory language
* clarify that a file can have `.epub` extension without being a valid EPUB
* visually separate this from the repairable-diagnosis case
* avoid making it look like a failed repair attempt

Safe invalid-file wording examples:

* This file is not a valid EPUB
* The file extension is .epub, but the internal structure does not match an EPUB file
* This file cannot be repaired as an EPUB
* The extension was changed, but the file is not an EPUB

Avoid:

* destroyed book covers
* torn-page graphics
* cracked-screen imagery
* horror-style corruption
* huge red X marks
* fake system-dialog errors
* malware imagery
* encrypted-file or ransom imagery
* code fragments or XML background
* too many filenames
* labels that claim unsupported repairs
* copyrighted recognizable commercial covers
* fake interfaces of ebook platforms

---

## Copy Rules

Use direct, realistic language:

* Diagnose EPUB issues
* Is it really an EPUB?
* Find files with changed extensions
* Find what needs fixing
* Repair common EPUB problems
* Fix supported structure issues
* Save a repaired copy
* Keep the original safe
* Processed on your device
* No account
* No uploads
* My EPUBs
* Repaired and imported files
* Remove ads

Localized copy should preserve intent, not translate word-for-word.

The strongest global promise is:

**Fix common EPUB file issues and save a repaired copy.**

The strongest global trust proof is:

**File repair is processed on your device. No accounts. No uploads. The original EPUB remains unchanged.**

The strongest global safety proof is:

**Save a repaired EPUB copy.**

The safest privacy phrasing is:

**Processed on your device** or **file repair is processed on your device.**

Use “100% offline” only when the specific referenced flow is verified to work without internet, including monetization/access gates.

---

## Claims to Avoid Globally

Avoid any claim or visual implication of:

* Fixing every EPUB
* Guaranteed repair
* Universal file recovery
* Restoring deleted chapters or book text
* Recovering missing book content
* DRM removal
* DRM bypass
* Ebook downloads
* Free books
* Full EPUB editing
* EPUB text editing
* Metadata editing unless explicitly supported
* EPUB conversion unless explicitly supported
* Universal reader compatibility
* Official affiliation with ebook platforms
* Cloud processing
* Online repair
* AI repair
* Antivirus or malware cleaning
* Phone optimization
* Unlimited free repair unless true
* 100% offline unless verified for the exact flow

---

## Regional Differentiation Rules

Localization is not translation.

Each locale should adapt:

* problem framing
* invalid-file phrasing
* level of technical reassurance
* visual warmth
* accent temperature
* trust-proof placement
* headline length
* copy rhythm
* local file-status vocabulary
* choice of public-domain title or neutral book thumbnail
* how late and how lightly monetization is shown

But every locale must preserve:

* EPUB repair positioning
* problem-to-repair first impression
* invalid-file / changed-extension handling
* diagnosis before repair
* supported-repair qualification
* repaired-copy reassurance
* original-file preservation
* local file-processing truth
* no-account / no-upload proof
* clear technical boundaries
* monetization as secondary transparency

---

## Final Quality Bar

A locale strategy passes only if:

* the market angle is immediately understandable
* the first visual tells a believable EPUB recovery story
* original and repaired states are clearly connected
* invalid-file handling is clear and not dramatic
* invalid-file and repairable-diagnosis cases are visually distinct
* diagnosis is explained before or alongside repair
* the repaired-copy result is visible and credible
* the original-file preservation is clear
* local privacy proof is present
* My EPUBs, if shown, supports local continuity and does not look like a reader/store
* monetization, if shown, remains secondary
* palette instructions are specific
* the copy safe area is protected
* repair claims match current app behavior
* unsupported claims are avoided
* the app does not look like a generic cleaner, antivirus, editor, reader, cloud service, or universal recovery tool
* the strategy does not drift back into redundant repair / repaired / repair-summary screenshots

---

## Global Recommended Sequence

Use this compact sequence by default:

1. EPUB problem → repaired copy
2. Is it really an EPUB? / invalid-file case
3. Understand what failed / repairable diagnosis
4. Save a new repaired copy / original unchanged
5. Processed on your device / My EPUBs

Use an expanded sequence only when there is a specific need for more product depth:

1. EPUB problem → repaired copy
2. Is it really an EPUB? / invalid-file case
3. Understand what failed / repairable diagnosis
4. Save a new repaired copy / original unchanged
5. Processed on your device / My EPUBs
6. Settings / language / theme / remove ads, if visually strong
7. Additional repair result proof, only if it adds a distinct point
8. Additional local file continuity proof, only if it does not repeat screenshot 5

---

## Current Global Direction

Current strongest global promise:

**Fix common EPUB file issues and save a repaired copy.**

Current strongest user reassurance:

**Find out whether the file is really an EPUB, understand what failed, and keep the original EPUB unchanged.**

Current strongest visual proof:

**The same EPUB appears first with a small, understandable problem state and then as a clean repaired copy.**

Current strongest product completeness proof:

**Users can find repaired or imported files again in My EPUBs, while settings and remove-ads remain secondary support features.**

Current strongest conversion logic:

**Problem → valid EPUB check → repairable diagnosis → repaired copy → local control.**
