# EPUB Fixer — Creative Brief

## Purpose

Define the creative, commercial, visual, localization, and conversion strategy for Play Store listing assets of EPUB Fixer.

This brief guides:

* Play Store copy generation
* feature graphic direction
* screenshot strategy
* regional localization
* golden listings
* bulk ficha generation
* strategy matrix generation
* conversion audits
* asset QA

This document is the strategic source of truth.

All generated fichas, golden listings, strategy matrices, conversion audits, and Play Store asset instructions must follow this brief.

The current approved direction is a compact, clear, non-redundant Play Store set:

**5 screenshots, clean and neat.**

The product should not be overexplained through separate screenshots for every internal step. The listing must sell the real user journey:

**EPUB not working → check if it is really an EPUB → understand the repairable issue → save a repaired copy → keep files local and private.**

---

## Product Identity

### Working product name

EPUB Fixer

### Suggested localized product naming

Depending on locale, the app may use a direct local equivalent when it is clearer and remains searchable.

Examples:

* EPUB Fixer
* Repair EPUB
* Reparar EPUB
* Arreglar EPUB

The chosen name must remain under the Play Store 30-character limit and must not imply universal repair, DRM removal, full EPUB editing, ebook downloading, cloud conversion, AI repair, or official platform support.

### Category

EPUB utility / ebook file repair / digital library maintenance.

### What the app really is

A focused EPUB utility that helps users select an EPUB from their device, check whether the file is actually a valid EPUB, diagnose supported internal structure problems, repair compatible issues, and save a repaired version as a new copy.

It also includes a local My EPUBs area for repaired or imported files, basic settings for language and theme, and a monetization flow with ads, rewarded ads for some free repairs, fallback handling when ads cannot load, and an option to remove ads.

### What the app is not

* Not an EPUB reader
* Not a full EPUB editor
* Not a generic file manager
* Not a ZIP manager
* Not an ebook store
* Not an ebook downloader
* Not a format converter unless explicitly supported in the current build
* Not an antivirus or phone cleaner
* Not a DRM tool
* Not a DRM remover
* Not a cloud repair service
* Not an AI repair tool
* Not an official Amazon, Kindle, Kobo, Adobe, Apple Books, Google Play Books, or EPUB standards app
* Not a guarantee that every damaged EPUB can be restored

---

## Core Positioning

### Main positioning statement

Fix common EPUB file issues and save a repaired copy.

### Stronger practical interpretation

Find out whether an EPUB file is valid, understand what is wrong, repair supported structure problems, and keep the original file safe.

### Functional truth

The app helps users:

* select an EPUB file from the device
* check whether the file is a valid EPUB
* explain when a file only has an `.epub` extension but is not a real EPUB
* inspect supported EPUB structure elements
* diagnose supported EPUB issues
* check `mimetype`
* check `META-INF/container.xml`
* check the OPF package file
* check manifest entries
* check spine entries
* identify missing or invalid internal files
* detect broken manifest references
* detect invalid or empty spine entries
* repair supported internal structure problems
* remove or correct broken references when applicable
* rebuild a corrected EPUB file when possible
* save a new repaired EPUB copy
* keep the original EPUB unchanged
* view repaired or imported files in My EPUBs
* adjust language and theme settings
* remove ads through an upgrade option
* use a rewarded-ad flow for some free repairs, with fallback if the ad cannot load

### Supported repair scope

The app may support diagnosis and repair of issues such as:

* Missing or invalid `mimetype`
* Missing or unreadable `META-INF/container.xml`
* Missing or unreadable `content.opf` or OPF package data
* Broken or invalid manifest references
* Missing files referenced by the manifest
* Empty or invalid spine
* Invalid spine entries
* EPUB ZIP structure that cannot be read correctly
* Files that use the `.epub` extension but are not valid EPUB files
* Rebuilding a corrected EPUB after supported issues are handled

Only show, describe, or promise a repair in store assets if the current build actually performs it.

### Strategic balance

EPUB Fixer should be positioned as:

1. Practical EPUB recovery first
2. Valid EPUB detection second
3. Clear diagnosis third
4. Safe repaired-copy output fourth
5. Local file ownership and privacy fifth
6. Technical EPUB structure only as supporting proof

The user should understand the outcome before seeing technical terms.

The listing must never lead with XML, container files, manifest details, spine references, or package internals unless those terms appear as small secondary evidence inside a real diagnosis screen.

---

## Core Conversion Promise

### Primary conversion promise

Users can diagnose and repair common EPUB file problems without complicated desktop software.

### Secondary conversion promise

The app explains when a file is not a real EPUB, identifies repairable structure problems, and creates a separate repaired EPUB copy when possible.

### Trust proof

* Local EPUB selection
* Clear handling of files that are not real EPUBs
* Diagnosis before repair
* Supported repairs only
* Original file remains unchanged
* Saves a repaired EPUB as a new copy
* On-device file processing
* No accounts
* No uploads
* No cloud conversion
* My EPUBs for repaired and imported files
* Focused specifically on EPUB files

### Product Truth / Supported Feature Guardrails

The listing must stay aligned with what the app actually supports.

#### Safe promises

* Select EPUB files from the device
* Detect whether a file is a valid EPUB
* Explain invalid files that are not real EPUBs
* Diagnose common EPUB issues
* Check EPUB structure
* Check mimetype, container.xml, OPF, manifest, and spine
* Find supported EPUB problems
* Repair supported EPUB structure issues
* Fix invalid package files when possible
* Handle broken manifest references when supported
* Handle invalid spine entries when supported
* Rebuild a corrected EPUB copy
* Save a new copy
* Keep the original unchanged
* View repaired or imported files in My EPUBs
* Change language and theme settings
* Remove ads through an upgrade option
* Process file repair locally on the device

#### Risky promises

Do not use these unless explicitly verified in the current build:

* Repair every EPUB
* Repair all corrupted EPUB files
* Restore lost book content
* Recover deleted chapters
* Fix DRM-protected ebooks
* Remove DRM
* Edit book text
* Edit metadata
* Convert EPUB to PDF, MOBI, AZW, or other formats
* Validate official EPUB compliance
* Guarantee reader compatibility
* Batch repair
* Cloud backup
* Automatic repair without review
* Full ebook recovery
* AI file repair
* Virus cleaning
* Support for every ebook reader
* Unlimited free repairs if the free flow has limits
* 100% offline in the free flow if rewarded ads may require internet

#### Important strategic truth

The app’s strongest promise is not:

Repair any damaged ebook automatically.

The strongest promise is:

I have an EPUB that is not opening or behaving correctly. This app can tell me whether it is a real EPUB, identify common supported issues, and create a repaired copy when possible.

---

## Monetization Truth

EPUB Fixer includes monetization, but monetization must never be the main creative hook.

### Current monetization truth

The app may include:

* ads in the free experience
* an option to remove ads
* a rewarded-ad flow for some free repairs
* fallback handling when a rewarded ad cannot load

### Monetization communication rule

The Play Store listing should sell the product first:

**Problem → EPUB validation → repairable diagnosis → repaired copy → local control.**

Monetization should be communicated as a secondary transparency point, preferably in settings, upgrade, or notes sections.

### Safe monetization phrasing

Use:

* Remove ads with an upgrade option
* Some free repairs may use a rewarded ad
* If an ad cannot load, the app explains the next step
* Upgrade to remove ads from the repair experience

Avoid:

* Free unlimited repairs
* Always offline
* 100% offline in the free ad-supported flow
* No ads, unless specifically referring to the ad-free version
* Making rewarded ads sound like a core feature
* Making the listing feel like a paywall

### Offline / privacy nuance

The app can truthfully emphasize:

* Files are processed on the device
* No accounts
* No uploads
* No cloud conversion

Do not claim the entire free experience is always offline if rewarded ads or ad loading may require internet.

If the paid or ad-free version truly works without internet for repair, that can be positioned as an ad-free/private workflow benefit, but it must be phrased carefully and only when verified.

---

## Main User Motivations

EPUB Fixer sells recovery, clarity, and reassurance.

### Top user motivations

* An EPUB does not open correctly
* An EPUB fails to import into a reading app
* A file has an `.epub` extension but may not be a real EPUB
* An EPUB has broken internal references
* A downloaded or transferred EPUB appears damaged
* An EPUB opens with missing content or navigation problems
* A personal EPUB export is not structured correctly
* The user wants to troubleshoot an EPUB without Calibre or desktop tools
* The user wants to preserve the original file before trying a repair
* The user needs a clean repaired copy for their digital library
* The user wants to understand what is wrong before modifying a file
* The user wants local processing without uploading private ebooks
* The user wants a simple place to find repaired or imported EPUB files again

### Audience

Primary audience:

People who have EPUB files that do not open, import, validate, or behave correctly because of common internal structure problems.

Secondary audience:

People who:

* maintain personal ebook libraries
* collect public-domain EPUBs
* receive EPUBs from friends, publishers, schools, or personal projects
* export EPUBs from writing or publishing tools
* transfer ebooks between devices
* manage ebooks on phones, tablets, e-readers, or computers
* want a simple mobile alternative to desktop EPUB troubleshooting tools
* want to avoid losing or overwriting their original files
* need a clear explanation when a file is not a real EPUB

### User mindset

The user is not looking for an advanced technical EPUB editor.

They are looking for a simple answer to a practical problem:

“My EPUB is broken. Can I fix it safely?”

The user values a working result, understandable diagnosis, and file safety more than raw technical detail.

---

## App-Specific ASO / SEO Strategy

### Core discoverability themes

* EPUB fixer
* fix EPUB
* repair EPUB
* broken EPUB file
* EPUB repair tool
* fix EPUB errors
* EPUB file repair
* corrupted EPUB
* diagnose EPUB
* EPUB structure repair
* repair ebook file
* fix ebook file
* EPUB not opening
* EPUB file issues
* repaired EPUB copy
* invalid EPUB file
* changed extension EPUB
* OPF
* manifest
* spine
* container.xml

### Important rule

SEO terms must appear naturally.

Do not stuff keywords unnaturally.

The copy should read like a focused and trustworthy product listing, not like a technical support page.

### Brand usage rule

Use EPUB descriptively as a file format.

Do not imply official endorsement, partnership, certification, or compatibility guarantees with ebook stores, ebook readers, publishers, or EPUB standards organizations.

Brand names should only be mentioned when strictly necessary and only as neutral user contexts, never as official affiliations.

---

## Global Creative Direction

### Brand feeling

* practical
* capable
* reassuring
* focused
* private
* reliable
* clear
* technical without intimidation
* recovery-oriented
* utility-first
* transparent
* safe

### The app should feel like

A refined, focused tool made for one useful job:

Diagnosing common EPUB problems, explaining invalid EPUB files, and creating a repaired copy safely when possible.

### The app should not feel like

* a generic phone cleaner
* an antivirus
* a hacker utility
* a ZIP extractor
* a full ebook editor
* an ebook reader
* a cloud conversion website
* a technical developer tool
* an AI repair service
* a piracy-adjacent utility
* a generic document-repair app
* a PDF repair app
* a paywall-first product

---

## Screenshot Philosophy

### The first screenshot must do this

Answer:

“My EPUB is not opening correctly. Can this help me fix it?”

### The first screenshot must not do this

Answer:

“What technical file details does this app inspect?”

### Approved compact screenshot logic

For consumer-facing ficha generation, the approved global set is:

1. **Pain point / broken EPUB to repaired EPUB transformation**
   Show the core user problem and the desired outcome.

2. **Invalid-file blocking case**
   Show when a file has an `.epub` extension but is not a valid EPUB.

3. **Repairable diagnosis case**
   Show a real EPUB with a supported structure problem detected before repair.

4. **Safe repaired-copy result**
   Show a repaired copy saved or ready to save, with the original unchanged.

5. **Local library + privacy trust**
   Show My EPUBs or equivalent local continuity, combined with no-account/no-upload messaging.

This is the current preferred strategy.

The app may contain selection screens, repair actions, repair summaries, settings, and monetization screens, but those should not be split into extra screenshots unless a specific regional experiment or full product listing requires it.

### Visual rule

At least 2 screenshots must visibly prove recovery or successful output.

The first screenshot must make the progression obvious in one glance:

**Problem EPUB → repaired EPUB**

The invalid-file screenshot must be explanatory, not dramatic.

The repairable diagnosis screenshot should appear early because the user needs to trust that the app understands the file before modifying it.

The repair action itself does not need its own screenshot if it repeats the same visual context as the diagnosis or repaired result.

The editor, repair details, local library, settings, or technical result should never be the first proof by itself.

---

## Feature Graphic Philosophy

The feature graphic should summarize the app in one glance.

### It should communicate

* EPUB problem detection
* EPUB repair
* before-and-after recovery
* practical file safety
* repaired copy output
* speed and simplicity
* local processing as secondary trust proof

### It should not communicate

* generic document editing
* PDF repair
* generic antivirus behavior
* malware cleaning
* AI generation
* cloud conversion
* technical XML editing
* ebook reading
* ebook downloading
* DRM removal
* universal repair guarantees
* ad/paywall mechanics as the main idea

---

## Visual Rules

### Device wrappers

Allowed, depending on the asset:

* phone mockup
* direct app screenshot
* EPUB card + repair transformation
* neutral ebook-preview mockup
* original file → repaired-copy composition
* diagnostic card + repaired result
* phone + simple file-recovery visual
* My EPUBs screen inside phone mockup
* settings screen inside phone mockup, only for later or expanded sets

Avoid device wrappers that strongly resemble Kindle hardware or official reader interfaces.

### Asset sizes

* vertical screenshot background: 1994x3456 px
* phone screenshot/mockup: 972x2106 px
* feature graphic: 1024x500 px
* image inside neutral ebook-preview mockup: preserve proportions that are readable and not tied to a branded device

### Background rules

Each ficha must define:

* base background
* secondary background
* accent color
* headline color
* subline color
* accent placement
* copy safe area
* texture rules
* forbidden elements behind text

### Mandatory production rule

Background instructions must protect the copy area.

Always specify:

* dimension
* base color
* secondary color
* accent color
* accent placement
* safe area for copy
* texture allowed
* forbidden elements behind text

### Global visual baseline

Recommended global baseline:

* primary background: `#151515`
* secondary background: `#252525`
* accent: `#B3261E`
* optional support accent: `#D4574F`
* optional cool support accent: `#7D98B5`
* headline color: `#FFFFFF`
* subline color: `#D9D9D9`
* bullet/support text color: `#E3C3C1`

### Why this baseline works

The charcoal base makes EPUB Fixer feel focused, stable, and practical.

The restrained repair-red accent communicates issue detection and restoration without making the app look dangerous or aggressive.

A subtle cool support accent may be used sparingly in locales where a more technical and trustworthy tone is beneficial, but red must remain controlled and never dominate the composition.

The visual energy should come from the repair transition itself, not from loud backgrounds.

### Accent usage rule

The accent color must remain restrained.

Use it for:

* diagnostic markers
* issue-status indicators
* thin before-and-after connectors
* controlled highlights around repaired output
* small callouts on real app screens
* visual separation between the original and repaired EPUB
* subtle session/progress continuity

Do not use it as:

* bright glow behind headlines
* full red error panels
* oversized warning triangles
* aggressive neon lighting
* dominant background color
* a fake security system
* flashing or alarm-like visual language

---

## Image Use Rules

### Preferred EPUB cover and file content

Depending on region, use:

* popular books without copyright restrictions in the target locale
* generic fictional book titles
* neutral ebook thumbnails
* abstract or illustrative covers
* carefully created non-copyrighted book art
* visual examples that clearly communicate a damaged-versus-repaired file state

Do not define exact book titles inside the golden listings or this brief. Final title selection should happen during screenshot production.

### Preferred “problem” state

* plain EPUB card with a small issue indicator
* neutral cover with a restrained broken-reference marker
* book file that looks incomplete or unreadable without using horror imagery
* visible message such as “Can’t open correctly” or “Structure issue found”
* incomplete file-state iconography used minimally
* a simple original EPUB card with a diagnostic status

### Preferred “repaired” state

* same EPUB title and cover
* cleaner status
* repaired-copy filename
* subtle confirmation marker
* readable “Ready” or “Repaired” result
* visible separation from the unchanged original file

### Invalid-file visual handling

For files that use the `.epub` extension but are not valid EPUB files, the tone must be explanatory, not dramatic.

Safe wording:

* This file is not a valid EPUB
* This file does not contain a valid EPUB structure
* It may use the .epub extension, but its internal structure does not match an EPUB file
* The file extension was changed, but the file is not an EPUB

Avoid:

* Your EPUB is destroyed
* Fatal error
* Repair failed
* Corrupted beyond repair
* Broken forever
* User-blaming language
* Any wording that suggests trying the same repair repeatedly

### Avoid

* destroyed-book visuals
* cracked screens
* giant broken-file icons
* fake system alerts
* virus imagery
* hacker terminals
* code fragments
* XML as a decorative background
* fake brand interfaces
* cloud-upload symbols
* copyright-recognizable commercial book covers
* visual language suggesting the app provides books
* visual language suggesting illegal downloads or DRM bypass
* generic PDF documents
* too many filenames or technical details at small sizes

---

## Regional Localization Principle

Localization is not translation.

Each region must answer:

* What EPUB problem does this market recognize fastest?
* Is “won’t open” more compelling than “file error”?
* Does the market respond better to speed, safety, clarity, privacy, or repair proof?
* What type of file issue should be shown visually?
* How much technical reassurance is useful before copy becomes intimidating?
* Should “repaired copy” or “keep original safe” be emphasized more?
* How direct should the headline be?
* What color intensity feels trustworthy and natural in that market?
* Should monetization be mentioned only in settings or also in store description?

---

## Locale Strategy Requirements

The generated strategy-matrix.md must define, per locale:

* locale
* market angle
* hero visual
* invalid-file visual
* repairable-diagnosis emphasis
* repaired-copy proof
* local/privacy trust proof
* monetization handling
* palette direction
* what to avoid

### Palette direction per locale

Each locale must define:

* primary background
* secondary background
* accent
* optional support accent
* headline color
* subline color
* bullet/support color

Do not leave palette instructions vague.

### Visual differentiation rule

Regional differentiation should be visible, but not random.

The product must remain recognizable as EPUB Fixer across all locales.

Change:

* problem-state phrasing
* invalid-file phrasing
* repairable-diagnosis phrasing
* repair-result phrasing
* visual temperature
* accent nuance
* degree of technical detail
* trust-proof priority
* public-domain book choice or neutral thumbnail style
* headline and subline construction

Do not change:

* product category
* recovery-first strategy
* valid-EPUB detection logic
* diagnosis-before-repair logic
* local processing truth
* safe feature claims
* repaired-copy reassurance
* original-file preservation
* compact 5-screenshot sequence unless there is a strong regional reason

---

## Golden Listings

The project should maintain at least two approved golden references:

* `docs/fichas/ef/en-US.golden.md`
* `docs/fichas/ef/es-MX.golden.md`

### Role of the golden listings

They are not meant to be copied literally.

They establish:

* persuasion quality
* visual specificity
* depth of copy
* screenshot ordering
* conversion-first logic
* safe feature claims
* technical-detail boundaries
* palette specificity
* asset production specificity
* monetization phrasing boundaries
* invalid-file communication tone
* compact-flow discipline

### Bulk generation rule

Any large-scale ficha generation must read:

* this creative brief
* the strategy matrix
* the golden listings

before generating locale-specific markdown files.

---

## Long Description Quality Standard

Long descriptions must be clear, practical, accurate, and conversion-focused.

### Target quality

A strong long description should include:

* direct problem hook
* immediate repair value proposition
* valid EPUB / invalid file explanation
* simple diagnosis-to-repaired-copy workflow
* selected EPUB context
* feature benefits explained as user outcomes
* repair-scope restraint
* privacy / local-processing proof
* safe-copy reassurance
* My EPUBs or local file continuity when relevant
* monetization transparency without making it the hook
* natural ASO keywords
* practical use cases
* focused closing statement

### Recommended length

* Minimum acceptable: 700 characters
* Preferred range: 900–1,700 characters
* Maximum: 4,000 characters

If a generated long description is under 600 characters, it should usually be revised unless a store or locale constraint requires shorter copy.

### Tone rule

The long description should feel helpful and capable, not dramatic, abstract, or overly technical.

This app solves a concrete file problem.

Do not over-romanticize it.

Do not write as if every EPUB can always be repaired.

### Description structure recommendation

1. Direct problem hook
2. Valid EPUB / invalid-file handling
3. Simple selection, diagnosis, and repaired-copy workflow
4. Feature bullets
5. Supported-repair qualification
6. Local/private trust proof
7. Safe-copy reassurance
8. My EPUBs / settings / ad-free option as secondary product completeness
9. Practical use cases
10. Focused closing line

---

## Short Description Quality Standard

Each locale should generate 3 candidates:

* SEO-first
* Conversion-first
* Balanced

The selected option must be chosen intentionally, not automatically.

### Rule

Do not default to “Balanced” every time.

Choose:

* SEO-first when people may search directly for EPUB repair terms
* Conversion-first when the pain point is obvious and urgent
* Balanced when it clearly combines search relevance and immediate understanding

### Strong short description patterns

Safe structures:

* Diagnose and repair common EPUB file issues
* Fix common EPUB problems and save a new copy
* Repair supported EPUB structure issues locally
* Find EPUB errors and create a repaired copy
* Check EPUB files and save a repaired copy
* Detect invalid EPUB files and repair supported issues

Avoid vague structures:

* Make your books work better
* Improve your reading experience
* Restore your library
* Fix any ebook instantly
* Repair your files with AI
* Clean broken documents

These are too vague, overbroad, or potentially misleading.

---

## App Name Quality Standard

The app name should be:

* clear
* searchable
* under the Play Store 30-character limit
* focused on EPUB repair
* not overly broad
* not framed as universal data recovery

### Good name patterns

* EPUB Fixer
* Repair EPUB
* Fix EPUB Files
* Reparar EPUB
* Arreglar EPUB

### Risky name patterns

* EPUB Editor
* Ebook Editor
* Universal File Repair
* Corrupted File Fixer
* Ebook Recovery Tool
* EPUB DRM Fixer
* AI EPUB Repair
* Ebook Converter
* Kindle Repair Tool
* PDF Repair Tool

---

## Screenshot Copy Rules

### Approved headline patterns

Use problem, validation, diagnosis, repair result, and safety language:

* EPUB not opening?
* Is it really an EPUB?
* Find files with changed extensions
* Know what went wrong
* Check the structure before repair
* Save a repaired copy
* Keep the original safe
* Your EPUBs, on your device
* No accounts. No uploads.
* Find repaired EPUBs again
* Repaired, imported, and never uploaded

### Weak headline patterns

Avoid generic feature-first copy:

* File manager
* ZIP scan
* XML analysis
* Manifest editor
* Spine editor
* Repair settings
* Advanced repair mode
* Export options
* Local files
* Technical report
* Watch ads to repair
* Upgrade screen

### Copy length rule

Headlines must remain readable in Play Store previews.

Spanish, German, French, Portuguese, Arabic, Japanese, Korean, and Traditional Chinese may require shorter, restructured copy because direct translation can become too long.

Do not preserve exact English sentence structure when a shorter, more native phrase converts better.

---

## Conversion Risks to Avoid

### Strategic risks

* Leading with settings
* Leading with the local file library
* Leading with technical EPUB internals
* Leading with monetization
* Making the app feel like a generic file cleaner
* Making the app feel like an antivirus
* Promising universal EPUB repair
* Promising repair of content that cannot be restored
* Implying DRM bypass
* Suggesting official ebook-platform affiliation
* Hiding invalid-file handling
* Hiding the diagnosis step
* Hiding the safe-copy behavior
* Hiding repair scope limitations
* Using privacy as the first and only value proposition
* Making the app sound like an ebook reader
* Making the app sound like an ebook downloader
* Making the app sound like a full EPUB editor
* Presenting code or XML as the main visual proof
* Claiming “100% offline” in contexts where ads may require internet
* Returning to 6–8 screenshots without distinct conversion value

### Visual risks

* low-contrast text
* bright areas behind copy
* issue and repaired states too similar
* invalid and repairable cases looking identical
* before-and-after relationship not obvious
* too much UI in screenshot 1
* too many technical terms in one screen
* dense raw repair logs
* giant warning icons
* aggressive full-red backgrounds
* fake error dialogs
* cluttered document stacks
* white panels behind headlines
* generic antivirus visuals
* cloud/upload imagery
* PDF-like document visuals
* fake ebook-reader interfaces
* unsupported repair claims in status labels
* rewarded-ad or paywall visuals appearing too early

---

## Deliverables Required for Each Locale

Each locale ficha must contain:

* App Name
* Short Description
* Long Description
* Market Angle Decision
* Regional Conversion Strategy
* Visual System
* Feature Graphic
* Screenshot 1
* Screenshot 2
* Screenshot 3
* Screenshot 4
* Screenshot 5
* Notes / Assumptions

### Required 5 screenshots

1. Main problem / broken EPUB to repaired EPUB transformation
2. Invalid-file / changed-extension case
3. Repairable diagnosis / structure issue found
4. Safe repaired-copy result / original unchanged
5. My EPUBs + local/privacy trust proof

Screenshots 6–8 are optional only for expanded product sets or specific experiments.

If additional screenshots are used, they must add distinct conversion value and must not merely repeat:

* repair action
* repair completed
* repair result
* save repaired copy

---

## Deliverables Required for Multi-Locale Generation

When generating multiple locales, the system must create:

* one ficha per locale
* `strategy-matrix.md`
* `conversion-audit.md`

### Strategy matrix must include

* locale
* market angle
* hero visual
* invalid-file visual
* repairable-diagnosis emphasis
* repaired-copy proof
* local/privacy trust proof
* monetization handling
* palette direction
* what to avoid

### Conversion audit should score

* app name clarity
* short description strength
* long description clarity
* screenshot 1 hook
* problem-to-repair clarity
* invalid-file handling
* repairable diagnosis clarity
* safe-copy proof
* My EPUBs / local continuity clarity
* regional differentiation
* visual specificity
* privacy/trust proof clarity
* monetization risk
* unsupported claim risk
* compact-flow discipline
* feature graphic clarity

---

## Current Approved Screenshot Sequence

### Compact global sequence

1. **Problem EPUB → repaired EPUB transformation**
   Hook: the user sees the problem and the desired outcome immediately.

2. **Invalid-file / changed-extension case**
   Hook: the app explains when a file is not a valid EPUB.

3. **Repairable diagnosis / structure issue found**
   Hook: the app identifies what went wrong before repair.

4. **Save a repaired copy / original unchanged**
   Hook: the user sees the safe output and understands the original is preserved.

5. **My EPUBs + local/private trust proof**
   Hook: repaired/imported files stay findable, local, and not uploaded.

### Current strongest visual sequence

1. “EPUB not opening?” / “¿Tu EPUB no abre bien?”
2. “Is it really an EPUB?” / “¿Es realmente un EPUB?”
3. “Know what went wrong” / “Entiende qué falló”
4. “Save a repaired copy” / “Guarda una copia reparada”
5. “Your EPUBs, on your device” / “Tus EPUBs, en tu dispositivo”

This compact sequence should be preserved unless a full product set is needed or a regional strategy explicitly justifies a different order.

---

## Current Preferred Visual System

### Global preferred palette

* primary background: `#151515`
* secondary background: `#252525`
* accent: `#B3261E`
* optional support accent: `#D4574F`
* optional cool support accent: `#7D98B5`
* headline color: `#FFFFFF`
* subline color: `#D9D9D9`
* bullet/support text color: `#E3C3C1`

### Alternative trust-focused palette

For locales where a calmer technical tone is likely to convert better:

* primary background: `#121416`
* secondary background: `#20272C`
* accent: `#7A8FA6`
* optional support accent: `#9FB2C5`
* headline color: `#F7F7F7`
* subline color: `#D6E0E3`
* bullet/support text color: `#DCE6F2`

### Palette migration rule

The charcoal-red palette is valid when it remains controlled and recovery-oriented.

For privacy-heavy or premium technical locales, a charcoal-slate-blue direction may be stronger because it feels less like an alert system and more like a reliable technical tool.

Never use red as a dominant background system or aggressive warning language.

---

## Golden Reference Notes

### en-US golden direction

The en-US listing should emphasize:

* EPUB not opening or working correctly
* invalid EPUB / changed-extension detection
* clear diagnosis before repair
* repair of common supported EPUB issues
* save-as-new-copy reassurance
* My EPUBs as local file continuity
* modern, capable utility aesthetic
* on-device file processing as trust proof
* no accounts and no uploads
* monetization only as secondary transparency

Preferred en-US tone:

Clear, capable, direct, reassuring, and technically credible without jargon.

### es-MX golden direction

The es-MX listing should emphasize:

* “¿Tu EPUB no abre bien?”
* practical and understandable recovery
* detecting files that are not real EPUBs
* knowing what failed before repairing
* repairs compatible with common EPUB problems
* a repaired copy without changing the original
* My EPUBs for repaired/imported files
* local processing
* no accounts
* no file uploads
* optional ad-free experience without making ads the main message

Preferred es-MX tone:

Direct, natural, helpful, clear, and non-intimidating.

---

## Final Quality Bar

The work is acceptable only if:

* the first screenshot sells a recognizable EPUB problem and recovery result
* the user understands the app’s purpose in one glance
* the listing clearly explains invalid EPUB / changed-extension handling
* the listing clearly distinguishes invalid files from repairable EPUB issues
* repair claims are limited to supported functionality
* the long description is practical, accurate, and not shallow
* technical language stays secondary to user outcomes
* the app does not look like an antivirus, generic cleaner, editor, reader, or cloud service
* the feature graphic clearly communicates problem → repair → new copy
* screenshots visibly prove the repaired outcome
* safe-copy behavior is clearly communicated
* My EPUBs is treated as useful file continuity, not as an ebook reader/library store
* local processing and privacy are clearly stated
* monetization is transparent but not dominant
* unsupported claims are avoided
* all background instructions protect text readability
* regional differentiation improves conversion without changing the product truth
* the screenshot set remains compact unless extra screenshots add distinct conversion value

---

## Notes for Current EPUB Fixer Direction

### Current strongest global promise

Fix common EPUB file issues and save a repaired copy.

### Strongest practical user promise

Find out whether your file is really an EPUB, understand what is wrong, repair supported structural issues, and keep the original safe.

### Strongest global trust proof

Files are processed on your device. No accounts. No uploads. The original EPUB remains unchanged.

### Current strongest category opportunities

* EPUB repair
* fixing EPUB files that do not open
* detecting invalid EPUB files
* identifying files with changed extensions
* diagnosing EPUB structure issues
* repairing invalid package references
* correcting supported manifest and spine problems
* creating repaired EPUB copies
* local/private EPUB processing
* practical mobile alternative to desktop troubleshooting tools
* clear handling of invalid files that are not real EPUBs
* local continuity through My EPUBs

### Current strongest screenshot sequence

1. EPUB with a visible problem transformed into a repaired EPUB
2. Invalid-file / changed-extension case
3. Repairable diagnosis
4. Save a repaired copy
5. Local-only trust proof through My EPUBs

### Current strongest conversion logic

Problem → valid EPUB check → repairable diagnosis → repaired copy → local control.

### Current strongest visual proof

The same EPUB shown in clear, distinct states:

A file that cannot open or has a structure issue
→
A repaired EPUB copy that is ready to use.

The invalid-file case must be visually distinct from the repairable-diagnosis case.

The relationship between the original and repaired copy must remain obvious.

### Current wording caution

Avoid saying “100% offline” for the full free experience if rewarded ads may be required.

Prefer:

* On-device file processing
* No accounts
* No uploads
* No cloud conversion

Use “offline” only when referring to a verified flow that truly does not require internet.
