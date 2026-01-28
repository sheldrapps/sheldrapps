# Sheldrapps Monorepo

Monorepo para ~10 apps Ionic + Angular, compartiendo un design system común.

## Estructura

```
C:\apps\
  package.json              # Root package con scripts globales
  pnpm-workspace.yaml       # Configuración de workspaces
  pnpm-lock.yaml           # Lockfile compartido
  apps\
    kindle-cover-creator\   # App 1
    ... (futuras apps)
  packages\
    ui-theme\              # Design system compartido
```

## Tecnología

- **pnpm workspaces**: Gestión de monorepo (compatible con Windows)
- **@sheldrapps/ui-theme**: Paquete interno con tokens + overrides seguros + callouts

## Comandos

### Instalación inicial

```bash
# Desde C:\apps
pnpm i
```

### Desarrollo

```bash
# Ejecutar kindle-cover-creator en modo dev
pnpm dev:kindle

# Otros comandos disponibles:
pnpm build:kindle    # Build de producción
pnpm lint            # Lint en todas las apps
pnpm build           # Build de todas las apps
```

### Agregar nueva app

1. Crear carpeta en `apps/nueva-app`
2. Agregar dependencia al design system:
   ```json
   {
     "dependencies": {
       "@sheldrapps/ui-theme": "workspace:*"
     }
   }
   ```
3. Ejecutar `pnpm install` desde la raíz
4. Importar estilos en los archivos SCSS de la app

## Design System (@sheldrapps/ui-theme)

### Uso

En `src/theme/variables.scss`:

```scss
@use "@sheldrapps/ui-theme/styles/tokens" as *;
```

En `src/global.scss`:

```scss
@use "@sheldrapps/ui-theme/styles/ionic-safe-overrides" as *;
@use "@sheldrapps/ui-theme/styles/callouts" as *;
```

### Estructura del paquete

- **`styles/_tokens.scss`**: Variables CSS (colores, radios, sombras, motion, callout tokens)
- **`styles/_ionic-safe-overrides.scss`**: Estilos seguros para componentes Ionic
- **`styles/_callouts.scss`**: Componente reutilizable de callout con variantes
- **`styles/index.scss`**: Exporta todos los módulos

### Reglas de "Safe Override Policy"

✅ **Permitido:**
- Modificar CSS variables de Ionic
- Estilizar `::part(native)` de componentes
- Añadir transiciones y micro-interacciones
- Usar clases opt-in (`.modal-card`, `.app-item`)

❌ **Prohibido:**
- Cambiar `padding`, `margin`, `display` globalmente en `ion-*`
- Setear `--width`/`--height` global en modales
- Romper comportamiento por defecto (ej: fullscreen modals)

### Tokens disponibles

#### Radios
- `--app-radius-sm`: 10px
- `--app-radius-md`: 12px
- `--app-radius-lg`: 16px

#### Sombras
- `--app-shadow-sm`: Sombra sutil
- `--app-shadow-md`: Sombra media

#### Motion
- `--app-ease`: cubic-bezier(.2,.8,.2,1)
- `--app-dur-fast`: 140ms
- `--app-dur-med`: 220ms
- `--app-focus-ring`: Focus ring consistente

#### Callouts
- Variantes: `.app-callout--warning`, `.app-callout--info`, `.app-callout--success`, `.app-callout--error`
- Estructura: `.app-callout`, `.app-callout__icon`, `.app-callout__title`, `.app-callout__body`

## Notas importantes

- Las dependencias se instalan **una sola vez** en la raíz
- Cada app se puede ejecutar por separado con `pnpm --filter <app-name> <script>`
- El paquete `@sheldrapps/ui-theme` es privado y solo está disponible dentro del monorepo
- Usar `@use` y `@forward` en lugar de `@import` para el paquete de estilos

## Próximos pasos

Para agregar más apps al monorepo:

1. Copiar estructura similar a `kindle-cover-creator` en `apps/`
2. Agregar `"@sheldrapps/ui-theme": "workspace:*"` a las dependencias
3. Importar estilos compartidos en SCSS
4. Agregar scripts en root `package.json` para dev/build
5. Ejecutar `pnpm install` desde la raíz
