$ErrorActionPreference = 'Stop'

$outDir = "docs/fichas/cover-creator-for-kindle"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$locales = @(
  @{ locale='ar-SA'; app='إنشاء أغلفة لـ Kindle'; purpose='Sell elegant and respectful visual personalization first.'; angle='Elegant and respectful reading personalization'; why='Refined, tasteful outcomes convert better than technical-first framing.'; hero='Refined personal image transformed into a tasteful e-reader cover'; second='Architecture or abstract art cover'; third='Travel memory or night reading mood cover'; trust='Correct model fit for Kindle, Kobo, Nook, PocketBook, Tolino'; p1='#1A1A2E'; p2='#E8DCC8'; p3='#C97A3F'; p4='#4A5F8F'; h='#F5F5F0'; s='#D9CEC0'; seo='تحويل صورك إلى أغلفة Kindle وKobo بسرعة.'; conv='اجعل قارئك يعكس ذوقك بغلاف أنيق.'; bal='حوّل صورك إلى أغلفة قارئ إلكتروني متوافقة.'; sel='conversion'; long='Create elegant covers from personal photos and art, then fit them to Kindle and other e-readers with a clear preview workflow.' },
  @{ locale='de-DE'; app='Cover Creator für Kindle'; purpose='Lead with practical precision and visible results.'; angle='Practical precision with clean personalization'; why='DE audiences respond to clarity, control, and predictable results.'; hero='Clear before/after fitted cover result'; second='Landscape or architecture with controlled crop'; third='Minimal personal cover with precise alignment'; trust='Exact model selection and reliable preview'; p1='#222831'; p2='#E5E9EF'; p3='#4B84C8'; p4='#7AA1C2'; h='#F8FBFF'; s='#D7E2EE'; seo='Kindle- und Kobo-Cover aus eigenen Fotos erstellen.'; conv='Gib deinem E-Reader ein Cover, das wirklich zu dir passt.'; bal='Fotos schnell in passende Kindle- und Kobo-Cover verwandeln.'; sel='seo'; long='Turn your photo into a clean e-reader cover with precise fit controls, preview confidence, and compatibility across major brands.' },
  @{ locale='es-MX'; app='Crear Portadas para Kindle'; purpose='Vender deseo emocional primero: portada personal que se sienta tuya.'; angle='Emotional personalization for daily reading identity'; why='En es-MX convierte mejor mostrar resultado emocional antes de la parte técnica.'; hero='Foto o recuerdo personal convertido en portada final'; second='Portada de mascota con tono cálido'; third='Portada de arte/aesthetic favorita'; trust='Selección correcta de modelo y soporte multi-marca'; p1='#1E2B38'; p2='#F3E7D3'; p3='#D96B4A'; p4='#4F86C6'; h='#F9FBFF'; s='#DCE7F4'; seo='Crea portadas Kindle y Kobo con tus fotos favoritas.'; conv='Haz tu e-reader más tuyo con una portada que te encanta.'; bal='Convierte fotos en portadas para Kindle y Kobo en minutos.'; sel='conversion'; long='Convierte una imagen querida en portada real para tu e-reader. Ajusta, previsualiza y guarda con confianza para Kindle, Kobo y más, con flujo simple y resultado visual claro.' },
  @{ locale='fr-FR'; app='Créer des Covers pour Kindle'; purpose='Promote tasteful visual identity for reading moments.'; angle='Tasteful visual identity for refined reading moments'; why='FR conversion improves with editorial aesthetics and subtle confidence.'; hero='Artistic photo adapted into elegant liseuse cover'; second='Cafe or architecture cover'; third='Minimalist photo/art cover'; trust='Reliable preview and model matching'; p1='#1F2A36'; p2='#F1E8DA'; p3='#BFA06A'; p4='#5A7C99'; h='#FAFCFF'; s='#DFE8F2'; seo='Créer des covers Kindle et Kobo depuis vos photos.'; conv='Personnalisez votre liseuse avec une cover vraiment à votre goût.'; bal='Transformez vos photos en covers adaptées pour liseuse.'; sel='balanced'; long='Transform your favorite image into an elegant e-reader cover with a simple workflow: choose image, fit, preview, save, and share.' },
  @{ locale='hi-IN'; app='Cover Creator for Kindle'; purpose='Show practical value with family/study personalization.'; angle='Practical personalization with family and study value'; why='hi-IN users often value clear utility plus personal meaning.'; hero='Personal or family photo as clean cover'; second='Study desk or routine reading cover'; third='Travel memory or colorful art cover'; trust='Broad compatibility and simple flow'; p1='#1B2636'; p2='#F3E6CE'; p3='#E39B2B'; p4='#4E85B5'; h='#FAFCFF'; s='#DDE8F3'; seo='Create Kindle and Kobo covers from your photos fast.'; conv='Make your e-reader personal with family and favorite moments.'; bal='Turn your photos into fitted e-reader covers in minutes.'; sel='seo'; long='Create personalized e-reader covers from photos and artwork with a practical flow and reliable fit for major models.' },
  @{ locale='it-IT'; app='Crea Cover per Kindle'; purpose='Sell personal taste and warm visual refinement.'; angle='Personal taste and visual refinement'; why='IT audiences respond to style, taste, and warm lifestyle visuals.'; hero='Stylish art/photo transformed into elegant cover'; second='City/travel image with warm mood'; third='Interior/bookshelf cafe aesthetic cover'; trust='Easy crop + preview + save/share'; p1='#2A2A31'; p2='#F2E5D2'; p3='#C76D4D'; p4='#6D8AA8'; h='#FBFCFF'; s='#E0E9F1'; seo='Crea cover Kindle e Kobo dalle tue foto preferite.'; conv='Dai al tuo e-reader una cover che rispecchia davvero il tuo stile.'; bal='Trasforma foto in cover per e-reader in modo semplice.'; sel='conversion'; long='From photos to elegant e-reader covers: adjust, preview, and export with a clear workflow built for daily reading style.' },
  @{ locale='ja-JP'; app='Kindle用カバー作成'; purpose='Prioritize calm minimal precision and quality.'; angle='Calm minimal precision and quality'; why='ja-JP often favors clean composition, control, and subtle confidence.'; hero='Minimal final cover on clean e-reader mockup'; second='Stationery/desk reading aesthetic'; third='Subtle manga or light-novel mood visual'; trust='Accurate fit and controlled preview'; p1='#1D2128'; p2='#EDE4D2'; p3='#C94D3F'; p4='#60748A'; h='#F7FAFF'; s='#D8E2EE'; seo='写真からKindle・Kobo向けカバーを作成。'; conv='好きな画像で、読む時間に合う上品なカバーを。'; bal='画像を電子書籍リーダー用カバーに簡単変換。'; sel='conversion'; long='Turn photos and artwork into clean e-reader covers with minimal steps, precise fit, and reliable preview before saving.' },
  @{ locale='ko-KR'; app='Kindle용 커버 만들기'; purpose='Show polished lifestyle personalization first.'; angle='Polished lifestyle personalization'; why='ko-KR responds to modern aesthetics and smooth mobile experience.'; hero='Modern aesthetic photo as clean cover'; second='Creator-style desk/setup visual'; third='Soft pet or travel lifestyle cover'; trust='Fast workflow and reliable model fit'; p1='#20262E'; p2='#EEE6D8'; p3='#72B8A3'; p4='#5B7FA1'; h='#F8FBFF'; s='#DAE5F0'; seo='사진으로 Kindle·Kobo 커버를 빠르게 제작하세요.'; conv='내 취향을 담은 커버로 전자책 리더를 더 멋지게.'; bal='사진을 맞춤 전자책 커버로 손쉽게 변환.'; sel='conversion'; long='Create polished e-reader covers from personal photos with an easy editor, clear preview, and trusted model compatibility.' },
  @{ locale='pt-BR'; app='Criar Capas para Kindle'; purpose='Lead with warm expressive personalization.'; angle='Warm expressive personalization'; why='pt-BR conversion benefits from emotional and vibrant lifestyle framing.'; hero='Favorite moment photo turned into final cover'; second='Pet cover with bright emotional tone'; third='Beach/travel lifestyle cover'; trust='Simple editor plus model confidence'; p1='#1B2A40'; p2='#F3E7D2'; p3='#E56B5D'; p4='#4F88C6'; h='#F8FBFF'; s='#DDE7F3'; seo='Crie capas Kindle e Kobo com suas fotos favoritas.'; conv='Deixe seu e-reader com a sua cara em uma capa que você ama.'; bal='Transforme fotos em capas ajustadas para e-readers.'; sel='conversion'; long='Transform personal moments into e-reader covers with a simple edit-preview-save flow and broad compatibility.' },
  @{ locale='ru-RU'; app='Создать обложки для Kindle'; purpose='Focus on direct practical result with visible control.'; angle='Direct practical result with visible control'; why='ru-RU tends to convert with concrete proof and predictable output.'; hero='Strong before/after transformation'; second='Nature/archive photo as fitted cover'; third='Classic reading mood with controlled crop'; trust='Compatibility, preview, predictable output'; p1='#232A33'; p2='#ECE4D5'; p3='#B85B4A'; p4='#5F7E99'; h='#F8FAFD'; s='#D9E3EE'; seo='Создавайте обложки Kindle и Kobo из своих фото.'; conv='Сделайте ридер личным: любимое фото как аккуратная обложка.'; bal='Преобразуйте изображения в подходящие обложки для ридера.'; sel='seo'; long='Get a clear, controlled transformation from photo to fitted e-reader cover with preview and dependable compatibility.' },
  @{ locale='zh-CN'; app='创建Kindle封面'; purpose='Position efficient polished output first.'; angle='Efficient polished output'; why='zh-CN users value clear efficiency and practical quality.'; hero='Clean final cover result with fast path'; second='Personal image adapted for daily reading'; third='Minimal art/photo output showing precision'; trust='Model compatibility and clear workflow'; p1='#1F2832'; p2='#ECE8DE'; p3='#D65A31'; p4='#5A7EA3'; h='#F7FAFF'; s='#D8E2ED'; seo='用照片快速制作Kindle与Kobo封面。'; conv='把喜欢的图片变成每天想看的阅读封面。'; bal='轻松将图片转换为适配电子阅读器的封面。'; sel='seo'; long='Create polished e-reader covers efficiently: choose image, fit to model, preview clearly, then save and share.' },
  @{ locale='zh-TW'; app='建立Kindle封面'; purpose='Promote tasteful lifestyle reading personalization.'; angle='Tasteful lifestyle reading personalization'; why='zh-TW often prefers warm, personal, and polished lifestyle messaging.'; hero='Warm elegant personal image as final cover'; second='Travel or art mood cover'; third='Cozy daily reading aesthetic cover'; trust='Clear preview and model correctness'; p1='#21303A'; p2='#EEE5D8'; p3='#E27D60'; p4='#5C839E'; h='#F8FBFF'; s='#DBE5F0'; seo='用照片製作 Kindle 與 Kobo 封面。'; conv='把你喜歡的畫面，變成每天閱讀都想看到的封面。'; bal='輕鬆將圖片轉成適配電子閱讀器的封面。'; sel='conversion'; long='Turn personal photos and art into polished e-reader covers with a simple flow and reliable model fit for daily reading.' }
)

function Pick-SelectedText($item) {
  if ($item.sel -eq 'seo') { return $item.seo }
  if ($item.sel -eq 'balanced') { return $item.bal }
  return $item.conv
}

foreach ($item in $locales) {
  $selected = Pick-SelectedText $item
  $appSuggestion = 'No change'
  if ($item.app.Length -gt 30) {
    $appSuggestion = 'Short variant recommended for Play Store 30-char limit'
  }

  $long = $item.long
  $appCount = $item.app.Length
  $shortCount = $selected.Length
  $longCount = $long.Length

  $content = @"
# $($item.app) - $($item.locale) Play Store Listing

## Purpose
$($item.purpose)

## App Name
Current localized name from strings.xml/app.title: $($item.app)
Suggested localized name, if needed: $appSuggestion
Character count: $appCount
Reasoning: Localized title reflects current app naming and category intent.

## Short Description
Candidates:
- SEO-first: $($item.seo)
- Conversion-first: $($item.conv)
- Balanced: $($item.bal)
Selected text: $selected
Character count: $shortCount
Reasoning: Selected strategy for this locale is $($item.sel), based on regional conversion behavior.

## Long Description
Text:
$long

Build covers from photos and artwork, preview before export, and keep the process simple. The app supports major e-reader brands and focuses on practical visual results.
Character count: $longCount
SEO/ASO notes: Includes Kindle, Kobo, e-reader cover, fit, preview naturally.

## Market Angle Decision
Market angle selected: $($item.angle)
Why this angle should convert in this locale: $($item.why)
Primary visual desire: $($item.hero)
Secondary trust proof: $($item.trust)
What should NOT be the first screenshot: Technical selector list or settings-only screen.
Feature-first risk: It can position the app as a utility instead of a desirable visual personalization tool.

## Regional Conversion Strategy
Primary user desire: Personal visual identity on the reading device.
Best use cases to show: $($item.hero); $($item.second); $($item.third).
What to avoid: Technical-first framing, repetitive visual sequence, and unsupported claims.
Search/ASO terms to include naturally: Kindle cover creator, Kobo cover, e-reader cover, custom cover.

## Visual System
Palette:
- primary background: $($item.p1)
- secondary background: $($item.p2)
- accent: $($item.p3)
- optional warm/cool accent: $($item.p4)
- headline color: $($item.h)
- subline color: $($item.s)
General visual rules: High-contrast safe copy zone at top-left; outcome-first imagery; no clutter behind text.

## Feature Graphic
titulo: Covers that match your reading style
subline: Turn photos and art into fitted e-reader covers
headline color: $($item.h)
subline color: $($item.s)
wrapper: composición gráfica con dispositivo + bullets
fondo:
- dimension: 1024x500 px
- base principal: $($item.p1)
- secundario: $($item.p2), soft atmospheric light only
- acento: $($item.p3)
- ubicacion del acento: right side behind device, low intensity
- zona segura de copy: left 40% with uniform dark contrast
- textura permitida: subtle paper grain at 3-5%
- elementos prohibidos: bright bars, noisy collage, medium gradients under text
imagen: kindle/e-reader emulado 1313x1751 px showing final desired cover result, not setup screens.
bullets:
- Photos and artwork
- Clear preview
- Kindle, Kobo and more
conversion intent: Outcome desire first, trust proof second.

## Screenshot 1
titulo: Desired result, immediately
subline: $($item.hero)
headline color: $($item.h)
subline color: $($item.s)
wrapper: kindle/e-reader emulado
fondo:
- dimension: 1994x3456 px
- base principal: $($item.p1)
- secundario: $($item.p2), subtle side light
- acento: $($item.p3)
- ubicacion del acento: upper right halo behind device
- zona segura de copy: top-left third, dark and clean
- textura permitida: fine paper grain 3%
- elementos prohibidos: bright overlays behind copy
imagen: imagen 1313x1751 px showing final outcome cover based on $($item.hero).
conversion intent: Hero desire outcome.

## Screenshot 2
titulo: Regional use case that feels relevant
subline: $($item.second)
headline color: $($item.h)
subline color: $($item.s)
wrapper: kindle/e-reader emulado
fondo:
- dimension: 1994x3456 px
- base principal: $($item.p1)
- secundario: $($item.p2), controlled glow
- acento: $($item.p4)
- ubicacion del acento: mid-right behind device edge
- zona segura de copy: upper left with flat dark tone
- textura permitida: matte grain 4%
- elementos prohibidos: hard highlights behind copy
imagen: imagen 1313x1751 px showing second use case outcome: $($item.second).
conversion intent: Second use case desire.

## Screenshot 3
titulo: Third angle to avoid repetition
subline: $($item.third)
headline color: $($item.h)
subline color: $($item.s)
wrapper: kindle/e-reader emulado
fondo:
- dimension: 1994x3456 px
- base principal: $($item.p1)
- secundario: $($item.p2), soft ambient light
- acento: $($item.p3)
- ubicacion del acento: lower right behind mockup
- zona segura de copy: top-left third with stable contrast
- textura permitida: paper fiber 3%
- elementos prohibidos: noisy collage background
imagen: imagen 1313x1751 px showing third outcome use case: $($item.third).
conversion intent: Third use case and regional differentiation.

## Screenshot 4
titulo: Fast workflow with clear control
subline: Crop, preview, and export confidently
headline color: $($item.h)
subline color: $($item.s)
wrapper: captura directa de app
fondo:
- dimension: 1994x3456 px
- base principal: $($item.p1)
- secundario: $($item.p2), subtle panel light
- acento: $($item.p4)
- ubicacion del acento: right edge glow
- zona segura de copy: upper left matte area
- textura permitida: subtle grain 4%
- elementos prohibidos: bright gradients under copy
imagen: screenshot 972x2106 px showing editor controls with live preview; proof of simplicity.
conversion intent: Mechanics trust after desire.

## Screenshot 5
titulo: Compatibility you can trust
subline: Kindle, Kobo, Nook, PocketBook, Tolino
headline color: $($item.h)
subline color: $($item.s)
wrapper: composición gráfica con dispositivo + bullets
fondo:
- dimension: 1994x3456 px
- base principal: $($item.p1)
- secundario: $($item.p2), soft diagonal wash
- acento: $($item.p3)
- ubicacion del acento: lower right behind compatibility badges
- zona segura de copy: top-left third with strong contrast
- textura permitida: low-noise grain 3%
- elementos prohibidos: logo clutter and tiny unreadable text
imagen: kindle/e-reader emulado 1313x1751 px plus compatibility cues as trust proof.
conversion intent: Confidence to install.

## Notes / Assumptions
- Verified in codebase: model-aware sizing, local save/share workflow, JPG/PNG/WebP support.
- Avoided unsupported claims: cloud sync, advanced layer/text editor, official Kindle/Amazon relationship.
- Premium/ads claims are intentionally conservative and not used as hero promise.
"@

  $path = Join-Path $outDir ("{0}.md" -f $item.locale)
  Set-Content -Path $path -Value $content -Encoding UTF8
}

Write-Host "Created $($locales.Count) locale files in $outDir"
