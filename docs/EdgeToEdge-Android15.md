# Edge-to-Edge Android 15

Fecha de implementación: 2026-03-03

## Resumen

Se centralizó la migración edge-to-edge en `packages/ui-theme` y se agregó un parche reproducible para `@capacitor/status-bar` con el fin de evitar el uso real de `Window.getStatusBarColor()` y `Window.setStatusBarColor()` en Android 15+.

## Auditoría local

- `SHORT_EDGES`: no hubo usos en código propio del monorepo.
- `@capacitor/status-bar@8.0.0`: sí usa `getStatusBarColorDeprecated()` y `setStatusBarColorDeprecated()` en Android.
- `androidx.activity`: ya estaba en `1.11.0`.
- `@capacitor-community/admob@8.0.0`: resuelve `com.google.android.gms:play-services-ads:24.9.+`.

## Versiones finales

- `@capacitor/android`: `8.0.2`
- `@capacitor/core`: `8.0.0`
- `@capacitor/status-bar`: `8.0.0` con parche local automatizado
- `androidx.activity`: `1.11.0`
- `androidx.core`: `1.17.0`
- `@capacitor-community/admob`: `8.0.0`
- `play-services-ads`: `24.9.+` a través del plugin AdMob

## Cambios aplicados

### Capa compartida web

- Nuevo `EdgeToEdgeService` en `packages/ui-theme`.
- Variables CSS globales:
  - `--safe-top`
  - `--safe-right`
  - `--safe-bottom`
  - `--safe-left`
  - `--keyboard-inset-bottom`
- Sincronización también hacia:
  - `--ion-safe-area-top`
  - `--ion-safe-area-right`
  - `--ion-safe-area-bottom`
  - `--ion-safe-area-left`
- Utilidades opt-in:
  - `.safe-top`
  - `.safe-right`
  - `.safe-bottom`
  - `.safe-left`
  - `.safe-x`
  - `.safe-all`
  - `.safe-top-toolbar`
  - `.safe-bottom-bar`

### Integración de apps

- ECC y CCFK inicializan `EdgeToEdgeService` una sola vez desde `AppComponent`.
- `ion-app` en ambas apps ahora usa `class="edge-to-edge-shell"`.

### Android compartido

- `MainActivity` en ECC y CCFK:
  - `WindowCompat.setDecorFitsSystemWindows(window, false)`
  - `LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS`
- Temas Android:
  - `android:windowLayoutInDisplayCutoutMode="always"` en `AppTheme.NoActionBar`
  - `android:windowLayoutInDisplayCutoutMode="always"` en `AppTheme.NoActionBarLaunch`

### Parche de StatusBar

- Script: `scripts/patch-capacitor-status-bar.cjs`
- Plantilla fuente: `scripts/templates/capacitor-status-bar/StatusBar.java`
- Hooks:
  - root `postinstall`
  - `prebuild` de ECC
  - `prebuild` de CCFK

#### Regla del parche

En Android 15+:

- no leer color real con `getStatusBarColor()`
- no intentar escribir color con `setStatusBarColor()`
- conservar solo:
  - icon appearance
  - overlay / edge-to-edge
  - `getInfo().height`

## QA manual pendiente

### Matriz mínima

1. Android 15, gestos, portrait
2. Android 15, 3 botones, portrait
3. Android 15, 3 botones, landscape
4. Android 14, sanity

### Casos

1. Home principal
2. Settings
3. Pantallas de editor/cropper
4. Modales preview con barra inferior
5. Interstitial/rewarded AdMob con botón close visible y clicable

## Notas

- No se agregó `windowOptOutEdgeToEdgeEnforcement`.
- No se usa `SHORT_EDGES` en código propio.
- En Android 15+ el color visual detrás del status bar debe resolverse desde layout/CSS, no desde `Window.setStatusBarColor()`.
