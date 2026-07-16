# Android UI Parity And System Bars

## Sintomas

- En Android, `ion-title`, toolbars, button lists o encabezados se ven distintos a `ionic serve`.
- La app web se ve correcta, pero en Android algunos componentes parecen renderizarse como markup plano o sin el chrome esperado.
- La status bar o nav bar no reaccionan al tema y se ven separadas del shell.

## Causas Verificadas

### 1. Runtime duplicado de Ionic

Cuando la app resuelve mas de una version de `@ionic/angular` o `@ionic/core`, Android puede terminar con clases host inconsistentes y componentes visualmente rotos.

## Reparacion Real

- Fijar la version de `@ionic/angular` de la app a la misma version activa del workspace.
- Agregar o mantener `pnpm.overrides` en la raiz para forzar una sola version de `@ionic/angular` y `@ionic/core`.
- Reinstalar dependencias, rebuild y `cap sync`.

## Reparacion Aplicada En Repo

- `package.json` raiz:
  - `pnpm.overrides.@ionic/angular = 8.8.8`
  - `pnpm.overrides.@ionic/core = 8.8.8`
- `apps/epub-merger-and-splitter/package.json`:
  - `@ionic/angular = 8.8.8`

### 2. Baseline de tema distinta entre web y Android

Si la app nace con tema `system`, Android puede resolver oscuro y web verse claro, o viceversa. Eso genera desfase global aunque el CSS sea correcto.

## Reparacion Real

- No usar `system` como default de primer arranque salvo que el brief lo pida.
- Elegir un baseline explicito que coincida con la referencia del producto, normalmente `light`.

## Reparacion Aplicada En Repo

- `apps/epub-merger-and-splitter/src/app/settings/epub-merger-and-splitter-settings.schema.ts`
  - default de `theme` alineado al baseline esperado.

### 3. Status bar desacoplada del tema

Si `ThemeService.initialize()` corre sin `EdgeToEdgeService.initEdgeToEdge()` antes, la status bar puede quedarse estatica o verse como un layer separado del resto de la app.

## Reparacion Real

- Inicializar `EdgeToEdgeService` antes de `ThemeService.initialize()`.
- Hacerlo en bootstrap (`APP_INITIALIZER` o bootstrap compartido), no en pantallas.
- No mezclar este flujo con overrides manuales de `StatusBar.setOverlaysWebView({ overlay: false })` salvo que la app quiera un shell no edge-to-edge.

## Reparacion Aplicada En Repo

- `apps/epub-merger-and-splitter/src/app/providers/epub-merger-and-splitter-bootstrap.initializer.ts`
  - `await edgeToEdge.initEdgeToEdge();`
  - `await theme.initialize();`

## Checklist

- Confirmar que web y Android usan una sola version de Ionic.
- Confirmar que Android arranca con el mismo baseline de tema esperado por producto.
- Confirmar en Android que status bar y nav bar cambian con el tema igual que `ccfk`, `ef` y `pcm`.
- Si Android sigue viendose distinto y web esta bien, revisar primero bootstrap, tema y versions de Ionic antes de tocar pantallas.
