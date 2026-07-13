---
name: create-ionic-app
user-invocable: true
description: "Scaffolds a new Ionic Angular app in this monorepo with tabs, settings, shared kits, and initial i18n. Use when the user asks to create, scaffold, bootstrap, or add a new app under `apps/*`."
---

# Create Ionic App (Monorepo Standard)

## First step: app naming intake

Before scaffolding anything, ask for the app name as a list of locale variants.

Required rules:

1. Accept names with or without a character count.
2. Validate every provided app name is under 30 characters.
3. If any locale name exceeds 30 characters, stop and ask for a corrected name.
4. Use `en-US` as the source of truth for naming derivations.
5. Derive:
   - `package name` from `en-US`, lowercase, no special characters, prefixed with `com.sheldrapps.`
   - `project name` from `en-US`, kebab-case
   - `short name` from the first letter of each word in the `en-US` name
6. Keep the `short name` consistent with the existing app aliases in the repo.
7. Ask which tabs the app will have, besides `Settings`.
8. Always include `Settings`.
9. Put `Settings` as the last tab.
10. Ask for each non-settings tab:
   - tab name
   - `ion-icon` name
11. Expect the response in `ion-icons` terms.
12. Default pattern:
   - `home-outline` - `Inicio`
   - `library-outline` - `Mis EPUBs`

## Workspace dependency intake

Ask explicitly:

`Esta app usará editor?`

Rules:

1. If the answer is yes:
   - implement the current editor entry pattern used by `ccfk`, `ecc`, and `pcm`
   - support both current entry buttons:
     - `image`: pass the selected image/file into the editor
     - `scratch`: open the editor without file input, starting from the base editor state
   - wire all input and output validations already used by those apps
   - keep this aligned with the current source of truth in the existing apps, not with a stale `image | scratch` interpretation
   - import and configure the editor-related providers and routes as needed
2. If the answer is no:
   - do not import the editor
   - do not wire editor providers
   - do not add editor routes, state, or assets
3. Treat the editor decision as a hard branch in scaffolding, not a later cleanup.

## Theme flow intake

Always include the current theme flow in `Settings`.

Rules:

1. Use `@sheldrapps/ui-theme` for theme selection, preview, persistence, and system sync.
2. Include the theme selector screen or section that mirrors the current apps.
3. Theme options must come from the supported theme list, not from a hardcoded ad-hoc array.
4. Persist the selected theme through the settings store/theme service flow already used by the repo.
5. Default theme is `system`.
6. Validate theme values with the existing normalization rules:
   - accept only `system` or a supported theme id
   - normalize invalid or legacy values back to `system`
7. Preserve the current behavior when the user changes theme:
   - changing the draft theme previews it immediately
   - confirming saves it
   - leaving without confirming restores the persisted theme
8. Keep system theme reactive:
   - when the stored mode is `system`, follow `prefers-color-scheme`
   - when a forced theme is active, ignore system changes
9. Apply the resolved theme to the document root and system bars using the current shared service behavior.
10. Initialize theme in app bootstrap so the first render uses the stored or default theme, not a stale visual state.
11. For native Android apps, do not leave theme initialization in `AppComponent` or a page constructor; gate first render through bootstrap-level initialization, preferably `APP_INITIALIZER` or an equivalent bootstrap barrier.

## Android startup hardening

Always scaffold the Android launch surface so the app does not start on a black frame.

Rules:

1. Add an explicit launch theme in `android/app/src/main/res/values/styles.xml`.
2. Use `Theme.SplashScreen` for the launch theme.
3. Set `android:windowBackground` to a dedicated launch drawable, not to a default dark surface.
4. Set `postSplashScreenTheme` to the real app theme.
5. Add `android/app/src/main/res/values-v31/styles.xml` for Android 12+ splash attributes.
6. Set `windowSplashScreenBackground` explicitly.
7. Set `windowSplashScreenAnimatedIcon` explicitly.
8. Keep the launch drawable non-black by default unless the product brief explicitly wants a dark splash.
9. If the scaffold generates tabs, include the `ion-router-outlet` inside the tabs shell template from the beginning.
10. Do not treat a black first frame as acceptable startup noise; if a cold launch screenshot is black before the UI appears, fix the splash/theme before closing the scaffold.

## Native Bootstrap Pattern

If the app needs a native Android entrypoint, scaffold Android startup so the first render is controlled from bootstrap.

Rules:

1. Create `src/main.native.ts` when the app needs native-only startup behavior.
2. Keep Android-specific initialization in `main.native.ts`, not in `AppComponent`, page constructors, or page lifecycle hooks.
3. Use a bootstrap barrier for theme, language, and other startup state that must complete before first render.
4. Prefer `APP_INITIALIZER` or an equivalent bootstrap gate when theme or language must resolve before Angular paints.
5. Keep `AppComponent` focused on routing, shell behavior, document title, and blur-on-navigation cleanup.
6. Do not duplicate startup policy between `main.ts` and `main.native.ts`; share providers if needed, but keep the native bootstrap decision centralized.
7. If the app has `main.native.ts`, include cold-start screenshot validation in the scaffold checklist.

## Language flow intake

Always include the current language selector flow in `Settings`.

Rules:

1. Use `@sheldrapps/i18n-kit` for language state, selection, normalization, translation, and restart behavior.
2. Include the current selector UI pattern:
   - an entry in `Settings` that opens a modal
   - a radio list powered by `LanguageRadioListComponent`
   - Cancel and Done actions in the modal header
   - a loading/countdown state before restart after confirmation
3. Source language options from the kit-backed supported language list, not from an ad-hoc hardcoded list.
4. Validate language values with the existing normalization rules:
   - accept only supported locale variants
   - map aliases/short codes through the kit normalization map
   - reject invalid or unsupported codes
5. Keep the draft/confirm flow:
   - open modal with current language as the draft baseline
   - changing the draft only updates local UI state
   - Cancel closes without persisting
   - Done commits the selected language
6. On confirm:
   - persist the language with `SettingsStore.setForScope('language', { language })`
   - update `LanguageService` with the selected language
   - show the restart countdown/loading state
   - call the shared restart helper for the selected locale
7. No-op when the chosen language is invalid, missing, already active, or a restart is already in progress.
8. Preserve the current bootstrap behavior:
   - initialize language in app bootstrap
   - if no stored language exists, detect a supported device locale
   - persist the detected language to settings before applying it
   - set the translation default language and then apply the active language through the kit
9. Keep document language, translation service, and app restart behavior aligned with the shared kit, not local one-offs.

## Privacy policy flow intake

Always include the static privacy policy section in `Settings`.

Rules:

1. Ask for the privacy policy link during intake.
2. Install the section as a static settings item, following the current `ccfk` pattern.
3. Render the privacy policy entry as a plain action row in `Settings`, not as a dynamic settings form.
4. Open the provided privacy policy URL with the same browser/open-url pattern already used by the repo.
5. If the app also has consent/privacy-options behavior, wire it only when that flow already exists in the source apps; do not invent it for apps that do not need it.
6. Keep the privacy policy link configurable per app, not hardcoded into the skill.
7. If the answer is `no`:
   - do not add the privacy policy section to the app
   - ask whether to create a new `incoming app` entry in `apps/sheldrapps-web`
   - if yes, ask which current app should be used as the base template
   - include the new incoming app privacy page and its 13 locale translations in the web change
   - keep the web-only change isolated in its own commit/push, separate from the app scaffold
8. When the web incoming app is created, follow the current privacy-page pattern from the existing Sheldrapps web privacy pages and keep the fallback locale as `en-US`.

## Rating flow intake

When the app will expose the `calificar / reportar un problema` entry in `Settings`, include the current `rating-kit` flow used by `ecc`, `ccfk`, and `pcm`.

Rules:

1. Ask whether the app will use rating / problem reporting.
2. If the answer is yes:
   - include `@sheldrapps/rating-kit` in the app scaffold
   - ask for the support email that will receive feedback
   - derive `appKey` from the app project slug unless the user asks for a custom key
   - keep the store review URL and web review URL on the shared kit defaults unless the user overrides them
   - wire `provideRatingKit(...)` in bootstrap
   - add the `Settings` actions that call `ratingService.previewPrompt()` and `ratingService.previewFeedbackFlow()`
   - use the shared kit labels `RATING.DEBUG.PREVIEW_PROMPT` and `RATING.DEBUG.PREVIEW_FEEDBACK`
3. If the answer is no:
   - do not import or wire `rating-kit`
   - do not add the rating buttons to `Settings`
4. Treat rating as a scaffold-time branch, not a later cleanup.

## Ads flow intake

Ask explicitly:

`Esta app usará ads?`

Rules:

1. If the answer is yes:
   - include `@sheldrapps/ads-kit` in the app scaffold
   - create an app-local `ads.config.ts`
   - ask for the rewarded ad unit IDs that belong to this app, not another app
   - at minimum, request Android `test.rewarded` and `prod.rewarded`
   - if the app will also wire iOS ads, request iOS `test.rewarded` and `prod.rewarded` too
   - wire `provideAdsKitI18n()` and `provideAdsKit(...)` in bootstrap using those app-specific units
   - do not reuse rewarded unit IDs from any other app
2. If the answer is no:
   - do not import or wire `ads-kit`
   - do not create ad unit config files
   - do not add ads billing or consent wiring beyond what the app already needs for other features
3. Treat ads as a hard branch in scaffolding, not a later cleanup.

## Settings flow checklist

When the app uses `Settings`, include these flows in this order:

1. Language
2. Theme
3. Privacy policy
4. Rating / report a problem, if enabled
5. Ads, if enabled
6. Editor, if enabled
7. App-owned i18n

## Exact intake prompt

Use this exact order when asking the user, but do it one question at a time:

1. Ask only the first question and wait for the answer before continuing.
2. After each answer, ask the next required question only.
3. Do not bundle multiple intake questions in a single message.

Question sequence:

1. `Dime el nombre de la app por locale, idealmente con este formato: en-US, es-MX, de-DE, fr-FR, it-IT, pt-BR, ar-SA, hi-IN, ja-JP, ko-KR, ru-RU, zh-CN, zh-TW. Si quieres, puedes agregar el conteo de caracteres.`
2. `Dime que tabs tendra ademas de Settings. Recuerda que Settings siempre va al final.`
3. `Para cada tab que no sea Settings, dime el nombre visible y el ion-icon que usara.`
4. `Dime el enlace de la politica de privacidad. Si no existe, responde no.`
5. `Dime si esta app usara calificar / reportar un problema. Si si, dime el correo de soporte.`
6. `Si respondiste no, dime si quieres crear una nueva incoming app en la web de Sheldrapps y, si si, en cual app actual debe basarse.`
7. `Dime si esta app usara ads. Si si, dame los rewarded ad unit IDs de esta app para Android test y prod, y tambien iOS si aplica.`

If any locale name is over 30 characters, stop and ask for a corrected name before continuing.

Example:

- `en-US: EPUB Merger & Splitter` -> `package name: com.sheldrapps.epubmergerandsplitter`
- `project name: epub-merger-and-splitter`
- `short name: emas`

## Checklist

1. Crear app en `apps/<new-app>`.
2. Agregar dependencias workspace en `apps/<new-app>/package.json`:
    - `@sheldrapps/settings-kit`
    - `@sheldrapps/ui-theme`
    - `@sheldrapps/i18n-kit`
    - `@sheldrapps/rating-kit` si el app usa el flujo de calificar/reportar un problema
    - Otras solo si se usan (`file-kit`, `ads-kit`, `image-workflow`, etc.).
3. Copiar bloque estándar de scripts desde `epub-cover-changer` / `cover-creator-for-kindle`:
   - `ng`, `start`, `prebuild`, `build`, `watch`, `test`, `lint`, `assets:android`, `debugApk`, `releaseApk`, `bundleRelease`.
4. Actualizar paths en `tsconfig.json` y `tsconfig.app.json`:
   - `../../packages/settings-kit/src/public-api.ts`
   - `../../packages/ui-theme/src/index.ts`
   - `../../packages/ui-theme/styles/*`
   - `../../packages/i18n-kit/src/public-api.ts`
5. Crear tabs base:
   - `src/app/tabs/tabs.page.html`
   - `src/app/tabs/tabs.routes.ts`
   - `tabs.page.html` debe incluir `ion-router-outlet` dentro de `ion-tabs`.
6. Si hay 3+ tabs, Settings debe ser el último.
7. Definir schema settings en:
   - `src/app/settings/<app>-settings.schema.ts`
8. Configurar `main.ts`:
    - `provideSettingsKit({ ... })`
    - `ConfigJsonFileAdapter` para `config.json`.
    - `provideI18nKit({ ... })` con `prefix: './assets/i18n/'`.
    - `provideRatingKit({ ... })` si el app usa el flujo de calificar/reportar un problema.
   - Si existe `src/main.native.ts`, mover ahí la política Android de arranque visual y dejar `src/main.ts` solo con bootstrap compartido.
9. Integrar estilos ui-theme:
   - `src/global.scss` -> `@use "@sheldrapps/ui-theme/styles/index" as *;`
   - `src/theme/variables.scss` -> mismo baseline.
10. Crear y validar el launch theme Android:
   - `android/app/src/main/res/values/styles.xml`
   - `android/app/src/main/res/values-v31/styles.xml`
   - launch drawable no negro
   - `postSplashScreenTheme` apuntando al tema real
11. Agregar scripts root si aplica (`dev:*`, `build:*`, `lint:*`).
    - Siempre agregar también los aliases del short name nuevo en el `package.json` raíz:
      - `dev:<short>`
      - `build:<short>`
      - `lint:<short>`
      - `resources:<short>`
      - `android:install:<short>`
      - `android:clean-install:<short>`
      - `phone:<short>`
      - `phone:<short>:me`
      - `clean-phone:<short>`
      - `clean-phone:<short>:me`
      - `bundleRelease:<short>`
      - `serve:<short>`
      - `serve:<short>:no-open`
      - `debugApk:<short>`
      - `releaseApk:<short>`
    - Si la sección de scripts raíz ya está creciendo demasiado, centralizar los shorts en un mapa y generar los aliases desde una sola fuente de verdad.
12. Configurar la firma Android de release para la app nueva antes de validar `bundleRelease`:
    - crear una keystore nueva para la app
    - agregar su ruta y alias en `android/gradle.properties`
    - apuntar `android/app/build.gradle` a esa keystore
    - verificar que `bundleRelease` use esa firma nueva
13. Si el scaffold incluye assets de tienda, crear también:
   - `2` screenshots simples
   - `1` feature graphic simple
   - `1` icono `512x512`
   - icono con fondo negro sólido y el `short name` de la app en letras blancas centradas

## i18n obligatorio desde scaffold

Toda UI debe usar keys de traducción. No hardcodear texto visible al usuario.

### App-owned i18n (base)

1. Crear `src/assets/i18n/<locale>.json` para los 13 locales soportados por defecto:
   - `en-US`
   - `es-MX`
   - `de-DE`
   - `fr-FR`
   - `it-IT`
   - `pt-BR`
   - `ar-SA`
   - `hi-IN`
   - `ja-JP`
   - `ko-KR`
   - `ru-RU`
   - `zh-CN`
   - `zh-TW`
2. Usar keys namespaced (por ejemplo: `TABS.HOME`, `SETTINGS.TITLE`).
3. Toda key nueva se agrega en todos los locales de la app dentro del mismo cambio.
4. `en-US` es el fallback base y la fuente de verdad para copiar o derivar el resto de traducciones.
5. No dejar locales incompletos si el scaffold declaró soporte para ese idioma.
6. Incluir siempre las traducciones de navegación de tabs (`TABS.*`) en los 13 idiomas desde el primer scaffold.
7. Si la app define tabs nuevas, agregar sus keys `TABS.<TAB>` en todos los locales en el mismo cambio.
8. Guardar todos los archivos `src/assets/i18n/*.json` en UTF-8 sin BOM.
9. Validar que no existan mojibakes, caracteres corruptos ni escapes Unicode en los values antes de cerrar.
10. Si aparece cualquier indicio de encoding roto, corregirlo en el mismo cambio y volver a validar.

### Kit-owned i18n standalone (cuando uses kits reusable)

Si un kit reusable trae UI propia, su i18n debe ser interno al kit y host-safe.

Patrón de integración en app host:

1. Importar provider del kit en `src/main.ts`:
   - ejemplo: `provideExportQualityKitI18n`, `provideBestCandidateKitI18n`.
2. Registrar provider junto al resto de providers.
3. Verificar que el kit hace merge no destructivo (`setTranslation(..., true)`) y fallback `en-US`.
4. Mantener compatibilidad `es-MX` / `es-419` cuando aplique.
5. Cuando una app soporte traducción propia, registrar siempre `en-US` como fallback inicial del host y del kit.

Regla: un kit reusable no debe depender de que el host cree manualmente sus keys para funcionar.

## config.json Persistence Pattern

Usar patrón real de:

- `apps/cover-creator-for-kindle/src/main.ts`
- `apps/epub-cover-changer/src/main.ts`

Piezas esperadas:

- `ConfigJsonFileAdapter({ primaryKey: "<app>.settings", fallbackAdapter: new WebLocalStorageAdapter() })`
- opcional cleanup legado con `CompositeStorageAdapter([new CapacitorPreferencesAdapter(), new WebLocalStorageAdapter()])`

Si intencionalmente no se usa `ConfigJsonFileAdapter`, documentar TODO en bootstrap.

## UI/UX and tokenization guardrails

- Reusar `@sheldrapps/ui-theme` primero.
- Evitar SCSS nuevo en app por default.
- Evitar hardcodes visuales cuando exista token equivalente (`--app-space-*`, `--app-text-*`, `--app-radius-*`, etc.).
- Mantener layout limpio y consistente (sin saturar sombras/bordes/colores).

## Validation Steps

1. `pnpm i`
2. `pnpm --filter <new-app> start`
3. `pnpm --filter <new-app> lint`
4. `pnpm --filter <new-app> build`
5. `pnpm test`
6. `pnpm lint`
7. `pnpm build`
8. En Android, hacer un cold start real:
   - sincronizar `cap`
   - instalar el APK
   - `force-stop`
   - abrir la app
   - capturar un screenshot a ~1s y otro a ~5s
   - si el primer frame sigue negro o vacío, corregir splash/theme antes de cerrar
9. Si existe `src/main.native.ts`, revisar que no haya init de theme/language/settings en `AppComponent` ni en constructores de páginas.

## Definition Of Done

No cerrar la skill hasta:

1. Pasar por `validacion` con los checks de i18n, UTF-8 y mojibake del scope tocado.
2. Confirmar que no hay corrupción de encoding en textos o traducciones.
3. Verificar que los `TABS.*` y demás strings nuevas quedaron completos en los 13 idiomas soportados.
4. Confirmar que `en-US` quedó como fallback base.
5. Confirmar en Android que no hay pantalla negra de arranque en cold start.

## Reporte esperado

Al finalizar, reportar:

- archivos creados/actualizados,
- locales inicializados,
- providers i18n registrados en `main.ts`,
- riesgos o pendientes.
