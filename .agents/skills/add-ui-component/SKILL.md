---
name: add-ui-component
user-invocable: true
description: "Creates or updates reusable UI components in @sheldrapps/ui-theme with tokens, accessibility, and host-safe i18n. Use when the user asks to build, reuse, redesign, or extract duplicated UI, or says 'hazlo como en...'."
---

# Add Reusable UI Component (ui-theme first)

## Cuándo usar esta skill

Úsala cuando el usuario pida:

- crear un componente nuevo,
- mejorar un componente UI existente,
- "hazlo como en ..." entre apps,
- extraer UI duplicada desde `apps/*` hacia `packages/ui-theme`.

## Principio rector

Priorizar componentes limpios, intencionales y consistentes.
Evitar ruido visual, hardcodes innecesarios y estilos locales en apps cuando el patrón es reutilizable.

## Flujo obligatorio

1. Buscar primero si ya existe componente, clase o patrón reutilizable:
   - `packages/ui-theme/src/lib/components`
   - `packages/ui-theme/styles/components.scss`
   - `packages/ui-theme/styles/tokens.scss`
2. Reusar antes de crear.
3. Si falta, implementar en `ui-theme` (no en app).
4. Exportar en:
   - `packages/ui-theme/src/lib/components/index.ts`
   - `packages/ui-theme/src/index.ts` (si aplica)
5. Consumir desde app con imports de `@sheldrapps/ui-theme`.

## Contrato de tokenización (obligatorio)

Siempre preferir tokens existentes de `ui-theme`.

Usar tokens para:

- espaciado: `--app-space-*`
- tipografía/tamaños: `--app-text-*`
- pesos: `--app-font-*`
- radios: `--app-radius-*`
- sombras: `--app-shadow-*`
- motion: `--app-dur-*`, `--app-ease`
- tamaño táctil: `--app-touch-target`, `--app-control-min-height`
- colores semánticos: `--app-*` y `--ion-color-*`

Evitar hardcodes cuando exista token equivalente.

No usar por defecto:

- `font-size` en `px` para texto,
- colores hex directos en componentes (`#...`),
- opacidades arbitrarias sin intención semántica,
- spacing/radius manuales repetidos.

Si un token no existe y es reusable, crearlo en `packages/ui-theme/styles/tokens.scss`.

## i18n obligatorio para toda UI nueva

Ningún texto visible al usuario puede quedar hardcodeado.
Todo texto debe salir de keys de traducción.

### Modelo A: App-owned i18n (cuando la UI vive en app)

- Guardar keys en `apps/<app>/src/assets/i18n/<locale>.json`.
- Actualizar todos los locales soportados por esa app en el mismo cambio.
- Usar nombrespaced keys consistentes (ejemplo: `SETTINGS.EXPORT.QUALITY_TITLE`).

### Modelo B: Kit-owned i18n standalone (cuando la UI es reusable)

Para componentes/kits reutilizables, la traducción debe vivir dentro del kit y no depender de que el host agregue keys manualmente.

Patrón obligatorio (igual a `export-quality-kit` / `best-candidate-kit`):

1. Crear diccionario del kit en:
   - `packages/<kit>/src/lib/translations/<kit>.translations.ts`
2. Crear provider de i18n del kit en:
   - `packages/<kit>/src/lib/translations/provide-<kit>-i18n.ts`
3. El provider debe:
   - usar `TranslateService.setTranslation(lang, dict, true)` para merge no destructivo,
   - registrar traducciones al menos en `onLangChange`,
   - soportar fallback `en-US`,
   - incluir bridge `es-MX` <-> `es-419` cuando aplique Play Store/LatAm.
4. Exportar provider en:
   - `packages/<kit>/src/public-api.ts`
5. Integrar provider en host app (`main.ts`) con `provide<Kit>I18n()`.

Resultado esperado: el kit funciona con sus propias traducciones sin romper ni sobrescribir traducciones del host.

## Reglas de estructura de componente (Angular)

- Ubicación: `packages/ui-theme/src/lib/components/<component-name>/`
- Archivos mínimos:
  - `<component-name>.component.ts`
  - `<component-name>.component.html`
  - `<component-name>.component.scss`
- No usar template/style inline, salvo petición explícita del usuario.
- Preferir `ChangeDetectionStrategy.OnPush` en componentes presentacionales.
- Inputs/Outputs con nombres claros y semánticos.

## Reglas de UI/UX (limpieza visual)

- Mantener jerarquía visual clara (un foco principal por bloque).
- Evitar saturación de bordes, sombras, badges y colores fuertes al mismo tiempo.
- Mantener ritmo vertical consistente con tokens de spacing.
- Usar superficies semánticas compartidas (`app-*-surface`) cuando ya existen.
- Estados obligatorios: `default`, `hover/focus`, `active`, `disabled`, `loading` (si aplica).
- Responsive: debe verse bien en móvil y desktop sin romper layout.

## Accesibilidad mínima (obligatoria)

- Objetivos táctiles >= `44px` (usar tokens de touch-target).
- Soporte de navegación por teclado y `:focus-visible` con `--app-focus-ring`.
- `aria-label`/texto accesible en acciones icon-only.
- Contraste suficiente entre texto y fondo (evitar combinaciones de bajo contraste).
- Respetar `prefers-reduced-motion` en animaciones.

## Reglas de consumo en apps

- Importar desde `@sheldrapps/ui-theme` o desde el kit correspondiente.
- Evitar crear nuevo SCSS en app por default.
- Si hay override local inevitable:
  - mantenerlo pequeño,
  - documentar por qué no puede ir a `ui-theme`.

## Anti-patterns (prohibidos)

- Duplicar en `apps/*` un componente reusable.
- Mezclar lógica de negocio app-specific dentro de `ui-theme`.
- Introducir estilos que rompan consistencia global del design system.
- Resolver urgencia visual con CSS ad-hoc sin tokenización.
- Hardcodear textos UI en TS/HTML sin key de traducción.
- Hacer que un kit reusable dependa de keys que el host debe crear manualmente.

## Checklist de salida

- componente reusable implementado o reutilizado,
- exports actualizados,
- tokenización aplicada,
- sin hardcodes visuales evitables,
- i18n aplicado con keys,
- si es kit reusable: provider i18n standalone integrado,
- accesibilidad y estados verificados,
- consumo en app funcionando.

## Validación

1. Validación localizada (componente/app afectada):
   - `pnpm --filter <app-name> lint`
   - `pnpm --filter <app-name> build`
2. Guardrails globales al final:
   - `pnpm test`
   - `pnpm lint`
   - `pnpm build`

## Respuesta final esperada

Reportar:

- archivos modificados,
- tokens reutilizados o creados,
- keys i18n agregadas y dónde viven,
- si aplica, provider standalone agregado y cómo se integra al host,
- decisiones de UX clave,
- riesgos o pendientes.

No pegar archivos completos salvo que el usuario lo pida.
