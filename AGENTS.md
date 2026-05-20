# Sheldrapps Monorepo Agent Rules

Este repositorio es un workspace pnpm para apps Ionic + Angular y kits compartidos.

- Apps en `apps/*`
- Kits en `packages/*`
- Apps productivas actuales: `cover-creator-for-kindle`, `epub-cover-changer`, `presupuesto-ninos`

## Golden Commands

- Install: `pnpm i`
- Test guardrails/settings contracts: `pnpm test`
- Lint all workspaces: `pnpm lint`
- Build all workspaces with a `build` script: `pnpm build`
- Run one app locally: `pnpm --filter <app-name> start`

## Skills Source Of Truth

Las siguientes áreas ya están definidas por skills dedicadas en `.agents/skills/`.
No duplicar reglas aquí; seguir la skill correspondiente.

- `programar-ts`: SOLID/SRP, Clean Code/Clean Architecture, separación TS/HTML/SCSS, i18n obligatorio, kits-first.
- `add-ui-component`: tokenización ui-theme, UI/UX limpia, accesibilidad, i18n app-owned o kit-owned standalone.
- `create-ionic-app`: baseline de nueva app + wiring i18n/settings/ui-theme.
- `validacion`: lint/test/build, clasificación regresión vs error normal, no-regresión, checks i18n/mojibake, cierre de calidad.
- `incrementa-version-utilidades`: incremental Git para utilidades/version-notes Play Store.
- `fichas`: generación de fichas Play Store por locale.

## Reglas Que Sí Permanecen En AGENTS

### Versioning Rule (Critical)

- Si el usuario pide incrementar versión de una app (`ccfk`, `ecc`, etc.), usar `apps/<app>/android/app/build.gradle` como fuente (`versionCode`, `versionName`).
- No usar `package.json` para versionado de app móvil, salvo petición explícita de release npm.
- No se acepta como resultado cambiar solo `package.json` para este tipo de solicitud.
- No se acepta como resultado incrementar `versionCode` sin generar/actualizar `docs/utilities/<short-name>/utility.md`, `state.json` y `version-notes.xml`.

### Layout Alignment Rule (Critical)

- Para páginas que mezclan botones de acción e inset cards/lists, la alineación horizontal debe coincidir exactamente.
- Wrapper exacto para botones full-width superior/inferior:
  - contenedor: `padding: 0 var(--app-space-7)` (opcional bottom con `var(--app-space-8)`).
  - botón: `class="app-btn" expand="block"`.
- Para layouts JOS-style, preferir superficies tokenizadas de `ui-theme` (`app-accent-surface` + `app-accent-card-body` o `app-secondary-surface`).
- En workflow/status screens con patrón JOS, no usar `ion-list` como contenedor genérico de card.
- Usar `ion-list inset="true"` solo cuando el contenido sea semánticamente lista.
- Antes de cerrar:
  - bordes izquierdo/derecho de botón deben alinear con contenido card/list,
  - no introducir drift horizontal por padding extra.
