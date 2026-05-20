---
name: create-ionic-app
description: Crear app Ionic Angular nueva en monorepo con tabs, settings-kit, config.json, ui-theme, i18n inicial. Use when user asks create/scaffold app under apps/*, set settings as last tab, or wire bootstrap with shared kits.
---

# Create Ionic App (Monorepo Standard)

## Checklist

1. Crear app en `apps/<new-app>`.
2. Agregar dependencias workspace en `apps/<new-app>/package.json`:
   - `@sheldrapps/settings-kit`
   - `@sheldrapps/ui-theme`
   - `@sheldrapps/i18n-kit`
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
6. Si hay 3+ tabs, Settings debe ser el último.
7. Definir schema settings en:
   - `src/app/settings/<app>-settings.schema.ts`
8. Configurar `main.ts`:
   - `provideSettingsKit({ ... })`
   - `ConfigJsonFileAdapter` para `config.json`.
   - `provideI18nKit({ ... })` con `prefix: './assets/i18n/'`.
9. Integrar estilos ui-theme:
   - `src/global.scss` -> `@use "@sheldrapps/ui-theme/styles/index" as *;`
   - `src/theme/variables.scss` -> mismo baseline.
10. Agregar scripts root si aplica (`dev:*`, `build:*`, `lint:*`).

## i18n obligatorio desde scaffold

Toda UI debe usar keys de traducción. No hardcodear texto visible al usuario.

### App-owned i18n (base)

1. Crear `src/assets/i18n/<locale>.json` para todos los locales soportados por la app.
2. Usar keys namespaced (por ejemplo: `TABS.HOME`, `SETTINGS.TITLE`).
3. Toda key nueva se agrega en todos los locales de la app dentro del mismo cambio.

### Kit-owned i18n standalone (cuando uses kits reusable)

Si un kit reusable trae UI propia, su i18n debe ser interno al kit y host-safe.

Patrón de integración en app host:

1. Importar provider del kit en `src/main.ts`:
   - ejemplo: `provideExportQualityKitI18n`, `provideBestCandidateKitI18n`.
2. Registrar provider junto al resto de providers.
3. Verificar que el kit hace merge no destructivo (`setTranslation(..., true)`) y fallback `en-US`.
4. Mantener compatibilidad `es-MX` / `es-419` cuando aplique.

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

## Reporte esperado

Al finalizar, reportar:

- archivos creados/actualizados,
- locales inicializados,
- providers i18n registrados en `main.ts`,
- riesgos o pendientes.
