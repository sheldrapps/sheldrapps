# Sheldrapps Monorepo

Repo pnpm para apps Ionic + Angular y kits compartidos.

- Apps en `apps/*`
- Kits en `packages/*`
- Apps productivas: `cover-creator-for-kindle`, `epub-cover-changer`, `presupuesto-ninos`

## Commands

- Install: `pnpm i`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Run one app: `pnpm --filter <app-name> start`

## Skills

Skills viven en `.agents/skills/`.

- `programar-ts`: TypeScript, refactors, i18n, kits-first
- `validacion`: lint/test/build y checks i18n/mojibake
- `add-ui-component`: UI, tokens, accesibilidad, i18n
- `handoff`: resumen compacto para continuar en otra sesion
- `write-a-skill`: crear o actualizar skills
- `taste`: direccion visual fuerte para UI nueva o redesign con libertad
- `impeccable`: audit, polish, redesign y limpieza de UI ya hecha
- `emil-design-eng`: revision estricta de animaciones y motion

## Default Mode

- `caveman` es el formato por defecto: breve, directo, sin relleno. Solo expandir si el usuario pide detalle.

## Repo Rules

- Kits-first: antes de duplicar UI o logica en `apps/*`, revisar si va en `packages/*`
- Kits-First Rule: preferir mover UI compartida a `packages/*` en vez de copiarla en `apps/*`
- TypeScript: usar `programar-ts` y `validacion`
- UI: usar `add-ui-component`
- UI nueva o con libertad visual: usar `taste` para definir direccion antes de construir
- UI ya construida: usar `impeccable` para limpiar, auditar y pulir
- Animaciones: usar `emil-design-eng` para validar decisiones de motion
- Versionado de apps moviles: usar `apps/<app>/android/app/build.gradle` como fuente de `versionCode` y `versionName`
- Si se incrementa `versionCode`, actualizar tambien `docs/utilities/<short-name>/utility.md`, `state.json` y `version-notes.xml`
- Layouts con botones + cards/lists: mantener alineacion horizontal exacta y usar `class="app-btn" expand="block"` en botones full-width
- En workflows/status screens con patron JOS, evitar `ion-list` como contenedor generico de card
