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

EPUB Fixer lets users select an EPUB from the device, prepare a safe repair session, diagnose common supported EPUB structure issues, repair compatible problems, explain the result, and save a repaired EPUB as a new copy without changing the original file.

The product may also communicate, as secondary product completeness:

* My EPUBs for repaired or imported files
* language and theme settings
* remove-ads option
* rewarded-ad access for some free repairs
* fallback handling if an ad cannot load
* clear handling for files that are not real EPUBs

## Global Strategy

The core conversion journey is:

**EPUB with a problem → safe session → clear diagnosis → supported repair → repaired copy → local control**

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

## Strategy Matrix

| Locale | Market angle                                                               | Hero visual                                                                                                      | Problem-state idea                                                                     | Repaired-state idea                                                          | Diagnosis emphasis                                                      | Workflow emphasis                                                                                 | Trust proof                                                                                          | Monetization handling                                                                                   | What to avoid                                                                                                                                                       | Background base | Background secondary | Accent color | Support accent | Title color | Subline color | Bullet color | Notes                                                                                                                       |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------- | ------------ | -------------- | ----------- | ------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| en-US  | Fast, practical EPUB repair for files that do not open or behave correctly | Same EPUB shown as “Needs repair” and “Repaired copy ready”                                                      | Neutral EPUB card with subtle “Can’t open correctly” or “Structure issue found” status | Same title and cover, clean repaired status, distinct copy filename          | Clear diagnosis before modification; show 2–3 concise issues            | Select EPUB → safe session → diagnose → repair → review → save copy → My EPUBs                    | On-device file processing. No accounts. No uploads. Original unchanged.                              | Mention remove ads only as secondary transparency. Rewarded ads should not appear in early screenshots. | Universal-repair claims, antivirus visuals, XML-first opening, full-editor language, “100% offline” if ads may load                                                 | `#151515`       | `#252525`            | `#B3261E`    | `#D4574F`      | `#FFFFFF`   | `#D9D9D9`     | `#E3C3C1`    | Lead with urgency and recovery. A restrained slate-blue secondary highlight may be used for a more technical, premium mood. |
| es-MX  | Recuperar un EPUB que no abre bien, sin complicaciones                     | Problema visible → copia reparada con mensaje claro                                                              | Tarjeta EPUB con “No abre correctamente” o “Problema detectado”                        | Mismo EPUB con “Copia reparada lista” y nombre terminado en `_reparado.epub` | “Entiende qué falló” antes de reparar; evitar jerga en el titular       | Elegir EPUB → preparar sesión → revisar problema → reparar → confirmar → guardar copia → My EPUBs | Procesamiento del archivo en tu dispositivo. Sin cuentas. Sin subir archivos. El original no cambia. | Quitar anuncios puede aparecer en ajustes o cierre. No vender anuncios recompensados como beneficio.    | Lenguaje demasiado técnico, reparación garantizada, estética de antivirus, pantalla de diagnóstico como primera imagen, “100% offline” en flujo gratis con anuncios | `#151515`       | `#252525`            | `#B3261E`    | `#D4574F`      | `#FFFFFF`   | `#D9D9D9`     | `#E3C3C1`    | Debe sentirse directa y tranquilizadora. “¿Tu EPUB no abre bien?” es más fuerte que una explicación de estructura interna.  |
| de-DE  | Diagnóstico preciso y reparación controlada de problemas EPUB compatibles  | Comparación sobria: archivo con incidencia → copia reparada                                                      | EPUB minimalista con estado “Problem erkannt” o equivalente                            | Resultado limpio con estado “Reparierte Kopie bereit”                        | Mostrar hallazgos claros y estructurados, sin adornos                   | EPUB wählen → sichere Sitzung → prüfen → reparieren → Ergebnis prüfen → Kopie speichern           | Lokale Dateiverarbeitung. Kein Konto. Kein Upload. Original bleibt erhalten.                         | Werbefreie Option nur sachlich y en pantallas finales. Evitar tono promocional agresivo.                | Lenguaje emocional exagerado, promesas vagas de reparación mágica, visuales saturados, compatibilidad absoluta, offline no verificado                               | `#121416`       | `#202326`            | `#7A8FA6`    | `#9FB2C5`      | `#F7F7F7`   | `#C9D0D4`     | `#DCE3EA`    | Priorizar precisión, claridad y control. La paleta debe sentirse técnica y confiable, no alarmista.                         |
| fr-FR  | Recuperación EPUB simple, clara y transparente                             | Progresión elegante: problème détecté → copie réparée                                                            | Libro digital neutro con alerta discreta, no dramática                                 | Mismo archivo con confirmación de reparación y copia nueva                   | Explicar el diagnóstico con términos humanos antes de detalles técnicos | Choisir EPUB → préparer → diagnostiquer → corriger → vérifier → enregistrer                       | Traitement du fichier sur l’appareil. Aucun compte. Aucun envoi. Original conservé.                  | Option sans publicité como soporte de experiencia, no como claim principal.                             | Apariencia de herramienta técnica hostil, nube, automatización opaca, mensajes demasiado secos o densos, paywall-first                                              | `#151518`       | `#242126`            | `#9E5A52`    | `#C98C84`      | `#FFFFFF`   | `#DDD4DC`     | `#EAB4AD`    | Debe equilibrar pulido editorial con utilidad concreta. El resultado reparado tiene que sentirse verificable, no abstracto. |
| it-IT  | Corregir problemas EPUB comunes de forma sencilla y segura                 | Antes/después cálido y claro con la misma tarjeta EPUB                                                           | Archivo EPUB con un problema comprensible y marcador discreto                          | Nueva copia limpia con confirmación visible                                  | Priorizar “qué se encontró” y “qué se corrigió” con lenguaje accesible  | Scegli EPUB → prepara → controlla → ripara → verifica → salva copia                               | Elaborazione del file sul dispositivo. Nessun account. Nessun upload. Originale invariato.           | Rimuovi annunci puede aparecer como polish de ajustes. No debe ocupar hero ni primeras capturas.        | Estética de limpiador de archivos, jerga excesiva, promesas de recuperar todo el contenido de un libro                                                              | `#181414`       | `#2B2320`            | `#C85A3E`    | `#E08A65`      | `#FFFFFF`   | `#E8D4CA`     | `#F0B69E`    | Puede ser más cálida, pero la narrativa debe seguir siendo funcional: diagnóstico y reparación, no embellecimiento.         |
| pt-BR  | Corrigir EPUB com problema e salvar uma cópia reparada                     | Transformação direta: EPUB com erro → EPUB corrigido                                                             | Cartão EPUB com “Problema encontrado” ou “Não abre corretamente”                       | Mesmo arquivo com estado “Cópia reparada pronta”                             | Explicação simples do problema antes da ação de reparo                  | Escolher EPUB → preparar sessão → diagnosticar → reparar → revisar → salvar cópia                 | Processamento do arquivo no dispositivo. Sem conta. Sem uploads. Original preservado.                | Remover anúncios como opção final. Evitar sugerir uso grátis ilimitado se não for verdade.              | Prometer reparação de qualquer EPUB, visual de antivírus, serviço em nuvem, ferramenta de limpeza genérica, “100% offline” com anúncios                             | `#161313`       | `#2A2020`            | `#D94B35`    | `#F27A55`      | `#FFFFFF`   | `#F0D2CC`     | `#FFC0A6`    | El acento puede ser más energético, pero los estados de problema y recuperación deben conservar una lectura clara.          |
| ar-SA  | Diagnóstico y reparación EPUB privados con una copia nueva segura          | Comparación RTL clara: problema a la derecha → resultado reparado a la izquierda, o flujo visual RTL consistente | EPUB con señal breve de problema, sin iconografía agresiva                             | Copia reparada con estado limpio y archivo separado                          | Diagnóstico breve, con jerarquía RTL y espacio suficiente para textos   | اختيار EPUB → تجهيز الجلسة → فحص → إصلاح → مراجعة → حفظ نسخة                                      | تتم معالجة الملف على الجهاز. بدون حساب. بدون رفع ملفات. يبقى الأصل دون تغيير.                        | Mention ad-free only in settings/final screen. Rewarded ads must not crowd RTL layouts.                 | Diseño LTR, texto compacto, decoración excesiva, promesas absolutas de recuperación, iconos de nube, monetización dominante                                         | `#101418`       | `#1C252B`            | `#B88A3A`    | `#E4C47A`      | `#FFFFFF`   | `#D7E0E3`     | `#E4C47A`    | Mantener una composición premium, sobria y RTL-safe. El oro/bronce funciona como indicador de restauración controlada.      |
| hi-IN  | Solución móvil clara para EPUB que no abre o tiene problemas comunes       | Comparación visual muy simple de archivo con problema y copia reparada                                           | EPUB con indicador entendible en inglés o hindi localizado, sin tecnicismos            | Resultado con estado “Repaired copy ready” o equivalente                     | Diagnosis must be short and visual, not code-heavy                      | Select EPUB → prepare → scan → repair → review → save copy                                        | File processing on device. No account. No uploads. Original stays unchanged.                         | Keep monetization simple: remove ads as optional. Avoid explaining rewarded ads in hero assets.         | Jargon técnico, capturas UI-first, copy confuso entre hindi e inglés, aspecto de limpiador de teléfono                                                              | `#151515`       | `#252018`            | `#D96B2B`    | `#FFC48F`      | `#FFFFFF`   | `#EED8C6`     | `#FFC48F`    | Usar lenguaje muy directo. Puede mantenerse inglés en términos como EPUB y “repair” si la localización final lo respalda.   |
| ja-JP  | Comprobar problemas EPUB y guardar una copia reparada con precisión        | Transformación minimalista y tranquila del mismo EPUB                                                            | Archivo con estado breve y discreto, equivalente a “Issue found”                       | Copia reparada con confirmación ordenada y sin exageración visual            | La pantalla de diagnóstico debe ser concisa, organizada y legible       | EPUB選択 → 準備 → 確認 → 修復 → 結果確認 → コピー保存                                                              | ファイルは端末上で処理。アカウント不要。アップロード不要。元のファイルはそのまま。                                                            | Ad-free option only as quiet settings detail. No ad-heavy store visual.                                 | Errores dramáticos, decoración intensa, terminología técnica larga, estética de antivirus, promesas absolutas                                                       | `#121416`       | `#1E2327`            | `#8F3A35`    | `#D49B96`      | `#F8F8F8`   | `#CDD5D8`     | `#D49B96`    | Priorizar calma, orden y precisión. La relación problema → copia reparada debe leerse sin depender de texto extenso.        |
| ko-KR  | Diagnosticar problemas EPUB comunes y guardar un resultado reparado        | Antes/después moderno con estados de archivo concisos                                                            | EPUB con marcador técnico discreto y mensaje breve                                     | Copia reparada visible, con estado limpio y nombre distinto                  | Mostrar que primero se diagnostica y después se repara                  | EPUB 선택 → 준비 → 진단 → 복구 → 결과 확인 → 복사본 저장                                                           | 파일은 기기에서 처리. 계정 없음. 업로드 없음. 원본은 그대로 유지.                                                              | Remove-ads as secondary product control. Avoid ad/rewarded mechanics in early visuals.                  | Que parezca un explorador de archivos, antivirus o herramienta que arregla todos los errores                                                                        | `#121417`       | `#1F2429`            | `#A83A32`    | `#DFA49D`      | `#FFFFFF`   | `#CDD6DC`     | `#DFA49D`    | La estética debe sentirse moderna, técnica y limpia. La interfaz real debe respaldar la promesa de reparación.              |
| ru-RU  | Diagnóstico práctico de EPUB y reparación de problemas compatibles         | Antes/después directo, sobrio y serio                                                                            | EPUB con mensaje equivalente a “Проблема обнаружена”                                   | Misma obra en una copia con estado “Исправленная копия готова”               | Mostrar hallazgos y resultado sin prometer recuperación total           | Выбрать EPUB → подготовить → проверить → исправить → просмотреть → сохранить копию                | Обработка файла на устройстве. Без аккаунта. Без загрузки файлов. Оригинал не изменяется.            | Mention ad-free as optional, not as core conversion. Avoid “free unlimited” implications.               | Promesas de recuperación total, DRM, nube, aspecto de herramienta de hacking o editor EPUB completo                                                                 | `#141414`       | `#202226`            | `#B13A32`    | `#E0A39C`      | `#FFFFFF`   | `#D2D6DA`     | `#E0A39C`    | Debe proyectar capacidad y seriedad. El texto debe subrayar reparaciones compatibles y copia segura.                        |
| zh-CN  | 检查常见 EPUB 问题并本地保存修复副本                                                      | Archivo EPUB con problema y resultado reparado claramente vinculados                                             | 状态简短，例如“发现问题”或“无法正常打开”                                                                 | 同一 EPUB 的修复副本，状态如“修复副本已就绪”                                                   | 强调先检查、再修复；技术细节保持次要                                                      | 选择 EPUB → 准备 → 检查 → 修复 → 查看结果 → 保存副本                                                              | 文件在设备上处理。无需账号。不上传文件。原文件不变。                                                                           | Remove-ads should be a late settings detail. Avoid ad mechanics in main conversion assets.              | 暗示完整 EPUB 编辑、AI 修复、云端处理、万能修复、安全软件式视觉或未验证离线承诺                                                                                                                        | `#111417`       | `#1D242A`            | `#C24130`    | `#EAA69C`      | `#FFFFFF`   | `#D4DDE1`     | `#EAA69C`    | 视觉必须高效、清晰、以结果为先。避免把内部结构术语放在主标题。                                                                                             |
| zh-TW  | 檢查常見 EPUB 問題並儲存修復副本                                                        | 清楚且信任導向的問題→修復流程                                                                                                  | EPUB 檔案卡搭配簡短問題狀態，例如「無法正常開啟」                                                            | 同一檔案的修復版本，清楚標示為新副本                                                           | 優先傳達「先了解問題，再進行相容修復」                                                     | 選擇 EPUB → 準備 → 檢查 → 修復 → 檢視結果 → 儲存副本                                                              | 檔案在裝置上處理。無需帳號。不需上傳。原始檔案不會變更。                                                                         | Ad-free option supports trust only if late and factual. Do not make ads the story.                      | 太像防毒、雲端檔案服務、一般清理工具、保證修復所有 EPUB 或未驗證離線承諾                                                                                                                             | `#121416`       | `#20272C`            | `#C6533D`    | `#ECB0A1`      | `#FFFFFF`   | `#D6E0E3`     | `#ECB0A1`    | Puede mantener un acento ligeramente editorial y cálido, pero el resultado debe sentirse confiable y técnicamente realista. |

## Visual Generation Rules

Do not reuse the exact same palette across all locales.

Keep a dark global identity, but localize:

* accent temperature
* intensity of the repair marker
* headline directness
* diagnosis detail level
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
* progress or result highlights
* small visual cues on real app screens
* restrained emphasis around the repaired copy

`Support accent` is used only as a softer secondary highlight. It must not dominate the scene or compete with the repaired EPUB result.

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

## Screenshot Strategy Rules

The full screenshot sequence should follow:

1. Problem EPUB → repaired EPUB copy
2. Select EPUB / prepare safe session
3. Clear diagnosis: what was found
4. Supported repair workflow
5. Repair result: what changed
6. Save a repaired copy: original unchanged
7. My EPUBs: repaired and imported files
8. Settings: language, theme, remove ads

The compact screenshot sequence should follow:

1. Problem EPUB → repaired EPUB copy
2. Clear diagnosis: what was found
3. Supported repair workflow
4. Repair result or save-copy proof
5. Save a repaired copy: original unchanged
6. Local processing / My EPUBs / no-account and no-upload proof

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

* show only as an optional later problem-case screenshot
* use calm explanatory language
* clarify that a file can have `.epub` extension without being a valid EPUB
* avoid making this the hero problem unless a specific locale strategy justifies it

Safe invalid-file wording examples:

* This file is not a valid EPUB
* The file extension is .epub, but the internal structure does not match an EPUB file
* This file cannot be repaired as an EPUB

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

## Copy Rules

Use direct, realistic language:

* Diagnose EPUB issues
* Find what needs fixing
* Repair common EPUB problems
* Fix supported structure issues
* Review what was repaired
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

## Regional Differentiation Rules

Localization is not translation.

Each locale should adapt:

* problem framing
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
* diagnosis before repair
* supported-repair qualification
* repaired-copy reassurance
* original-file preservation
* local file-processing truth
* no-account / no-upload proof
* clear technical boundaries
* monetization as secondary transparency

## Final Quality Bar

A locale strategy passes only if:

* the market angle is immediately understandable
* the first visual tells a believable EPUB recovery story
* original and repaired states are clearly connected
* diagnosis is explained before or alongside repair
* the repair result is visible and credible
* the original-file preservation is clear
* local privacy proof is present
* My EPUBs, if shown, supports local continuity and does not look like a reader/store
* monetization, if shown, remains secondary
* palette instructions are specific
* the copy safe area is protected
* repair claims match current app behavior
* unsupported claims are avoided
* the app does not look like a generic cleaner, antivirus, editor, reader, cloud service, or universal recovery tool

## Global Recommended Sequence

Use this full sequence when showing the product as a complete app:

1. EPUB problem → repaired copy
2. Start with your EPUB / safe session
3. Understand what failed
4. Repair supported issues
5. Review what was repaired
6. Save a new repaired copy
7. Find repaired/imported EPUBs
8. Adjust language, theme, and ad-free option

Use this compact sequence when only six screenshots are available:

1. EPUB problem → repaired copy
2. Understand what failed
3. Repair supported issuesW
4. Review what was repaired
5. Save a new repaired copy
6. Processed on your device / My EPUBs

## Current Global Direction

Current strongest global promise:

Fix common EPUB file issues and save a repaired copy.

Current strongest user reassurance:

Understand what failed before repairing, and keep the original EPUB unchanged.

Current strongest visual proof:

The same EPUB appears first with a small, understandable problem state and then as a clean repaired copy.

Current strongest product completeness proof:

Users can find repaired or imported files again in My EPUBs, while settings and remove-ads remain secondary support features.

Current strongest conversion logic:

Problem → session → diagnosis → repair → proof → safe copy → local control.
