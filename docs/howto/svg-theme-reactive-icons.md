# HOWTO: Convertir un SVG en un icono reactivo al tema

## Objetivo

Usar SVG inline para que un icono reutilizable responda automáticamente al tema activo, incluidos los temas claro, oscuro y personalizados.

## Patrón recomendado

1. Crear el componente en `packages/ui-theme/src/lib/components/<icon-name>/`.
2. Mantener el SVG en un archivo `.component.html`, no como `data:` URL ni como `<img>`.
3. Usar `currentColor` en los trazos o rellenos del SVG.
4. Hacer que el host herede el color y el tamaño desde tokens de `ui-theme`.
5. Exportar el componente desde `components/index.ts` y consumirlo desde los componentes compartidos.

Ejemplo:

```ts
@Component({
  selector: 'sh-pro-badge',
  standalone: true,
  templateUrl: './pro-badge.component.html',
  styleUrls: ['./pro-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class ProBadgeComponent {}
```

El SVG debe sustituir colores fijos por valores reactivos:

```html
<svg viewBox="0 0 72 32" fill="none" aria-hidden="true" focusable="false">
  <rect fill="var(--app-surface)" stroke="currentColor" />
  <text fill="currentColor">PRO</text>
</svg>
```

El CSS del host usa tokens existentes:

```scss
:host {
  display: inline-flex;
  width: calc(var(--app-icon-size-md) * 2.25);
  height: var(--app-icon-size-md);
  align-items: center;
  justify-content: center;
  color: var(--ion-color-primary);
  line-height: 0;
}

:host([slot='start']) {
  margin-inline-end: var(--app-space-2);
}

svg {
  display: block;
  width: 100%;
  height: 100%;
}
```

## Uso en listas compartidas

Si el botón se construye a partir de `SelectableButtonListItem`, extender el contrato del componente compartido con una variante semántica, por ejemplo `leadingIconSvg: 'pro-badge'`. El template de `sh-selectable-button-list` debe renderizar el componente SVG y conservar los caminos existentes para `leadingIconName`, `leadingIconSrc` y clases de banderas.

La app solo declara la intención:

```ts
{
  titleKey: 'COMMON.UPGRADE_TO_PRO',
  sublineKey: 'COMMON.REMOVE_ADS_CTA_SUBTITLE',
  leadingIconSvg: 'pro-badge',
}
```

No se debe duplicar el SVG ni agregar CSS específico en cada app.

## Accesibilidad y validación

- Los iconos decorativos deben tener `aria-hidden="true"` y `focusable="false"`.
- El texto del botón sigue siendo el nombre accesible de la acción.
- Usar `currentColor`; no fijar colores hex dentro del SVG.
- Reutilizar `--app-icon-size-md` y `--app-space-2`.
- Ejecutar lint y build de los hosts afectados.
- Verificar que el icono cambie de color en todos los temas disponibles.
