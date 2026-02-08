# Custom Icons

Íconos customizados para el sistema de diseño Sheldrapps. Todos los íconos usan `currentColor` para adaptarse automáticamente a los temas light/dark.

## Íconos disponibles

- `rotate-left.svg` - Rotar a la izquierda
- `rotate-right.svg` - Rotar a la derecha
- `flip-vertical.svg` - Voltear verticalmente (espejo horizontal)
- `flip-horizontal.svg` - Voltear horizontalmente (espejo vertical)

## Uso con SVG inline

Para mejor integración con el sistema de temas, se recomienda insertar el SVG directamente en el HTML:

### Rotate Left

```html
<span class="app-icon app-icon--md">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="39.2406" rx="0.548512" transform="matrix(-1 0 0 1 43.2528 4)" fill="currentColor" fill-opacity="0.43"/>
    <rect width="20" height="39.2406" rx="0.548512" transform="matrix(-1 0 0 1 43.2528 4)" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
    <path d="M13.0148 19.5175C12.7991 19.7321 12.4494 19.7351 12.2338 19.5242L8.71926 16.0876C8.50359 15.8767 8.50359 15.5318 8.71926 15.3172C8.93492 15.1027 9.28459 15.0997 9.50026 15.3106L12.6243 18.3653L15.7483 15.2572C15.9639 15.0426 16.3136 15.0396 16.5293 15.2505C16.7449 15.4614 16.7449 15.8063 16.5293 16.0208L13.0148 19.5175ZM16.7385 8.1483L16.6742 8.68986C15.0793 8.51893 14.1722 8.79185 13.6414 9.23677C13.1081 9.68369 12.8268 10.4101 12.7339 11.4418C12.6412 12.4713 12.7447 13.6968 12.8801 15.0368C13.0133 16.3565 13.1765 17.7797 13.1765 19.1309L12.6243 19.1357L12.072 19.1404C12.072 17.8569 11.9169 16.5001 11.781 15.1541C11.6471 13.8284 11.5304 12.5026 11.6338 11.3547C11.7369 10.209 12.0679 9.13201 12.9305 8.40907C13.7954 7.68412 15.0677 7.42076 16.8029 7.60673L16.7385 8.1483Z" fill="currentColor"/>
    <g filter="url(#filter0_d_1_41)">
      <rect width="40" height="19.6203" rx="0.548512" transform="matrix(-1 0 0 1 44 24.3797)" fill="currentColor"/>
      <rect x="0.274256" y="-0.274256" width="40.5485" height="20.1688" rx="0.822768" transform="matrix(-1 0 0 1 44.5485 24.3797)" stroke="currentColor" stroke-width="0.548512"/>
    </g>
    <defs>
      <filter id="filter0_d_1_41" x="3.01267" y="23.8312" width="41.9746" height="21.5949" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dy="0.43881"/>
        <feGaussianBlur stdDeviation="0.219405"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_41"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_41" result="shape"/>
      </filter>
    </defs>
  </svg>
</span>
```

### Rotate Right

```html
<span class="app-icon app-icon--md">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4.74716" y="4" width="20" height="39.2406" rx="0.548512" fill="currentColor" fill-opacity="0.43"/>
    <rect x="4.74716" y="4" width="20" height="39.2406" rx="0.548512" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
    <path d="M34.9852 19.5175C35.2009 19.7321 35.5506 19.7351 35.7662 19.5242L39.2807 16.0876C39.4964 15.8767 39.4964 15.5318 39.2807 15.3172C39.0651 15.1027 38.7154 15.0997 38.4997 15.3106L35.3757 18.3653L32.2517 15.2572C32.0361 15.0426 31.6864 15.0396 31.4707 15.2505C31.2551 15.4614 31.2551 15.8063 31.4707 16.0208L34.9852 19.5175ZM31.2615 8.1483L31.3258 8.68986C32.9207 8.51893 33.8278 8.79185 34.3586 9.23677C34.8919 9.68369 35.1732 10.4101 35.2661 11.4418C35.3588 12.4713 35.2553 13.6968 35.1199 15.0368C34.9867 16.3565 34.8235 17.7797 34.8235 19.1309L35.3757 19.1357L35.928 19.1404C35.928 17.8569 36.0831 16.5001 36.219 15.1541C36.3529 13.8284 36.4696 12.5026 36.3662 11.3547C36.2631 10.209 35.9321 9.13201 35.0695 8.40907C34.2046 7.68412 32.9323 7.42076 31.1971 7.60673L31.2615 8.1483Z" fill="currentColor"/>
    <g filter="url(#filter0_d_1_41_right)">
      <rect x="4" y="24.3797" width="40" height="19.6203" rx="0.548512" fill="currentColor"/>
      <rect x="3.72574" y="24.1055" width="40.5485" height="20.1688" rx="0.822768" stroke="currentColor" stroke-width="0.548512"/>
    </g>
    <defs>
      <filter id="filter0_d_1_41_right" x="3.01267" y="23.8312" width="41.9746" height="21.5949" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dy="0.43881"/>
        <feGaussianBlur stdDeviation="0.219405"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_41_right"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_41_right" result="shape"/>
      </filter>
    </defs>
  </svg>
</span>
```

### Flip Vertical

```html
<span class="app-icon app-icon--md">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="18" height="40" rx="0.548512" transform="matrix(0 -1 -1 0 44 21.5)" fill="currentColor" fill-opacity="0.43"/>
    <rect width="18" height="40" rx="0.548512" transform="matrix(0 -1 -1 0 44 21.5)" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
    <g filter="url(#filter0_d_1_41_flipv)">
      <rect width="18" height="40" rx="0.548512" transform="matrix(0 -1 -1 0 44 45)" fill="currentColor"/>
      <rect x="0.274256" y="0.274256" width="18.5485" height="40.5485" rx="0.822768" transform="matrix(0 -1 -1 0 44.5485 45.5485)" stroke="currentColor" stroke-width="0.548512"/>
    </g>
    <line x1="2" y1="24.5" x2="46" y2="24.5" stroke="currentColor"/>
    <defs>
      <filter id="filter0_d_1_41_flipv" x="3.01267" y="26.4515" width="41.9746" height="19.9747" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dy="0.43881"/>
        <feGaussianBlur stdDeviation="0.219405"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_41_flipv"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_41_flipv" result="shape"/>
      </filter>
    </defs>
  </svg>
</span>
```

### Flip Horizontal

```html
<span class="app-icon app-icon--md">
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="18" height="40" rx="0.548512" transform="matrix(-1 0 0 1 21.5 4)" fill="currentColor" fill-opacity="0.43"/>
    <rect width="18" height="40" rx="0.548512" transform="matrix(-1 0 0 1 21.5 4)" stroke="currentColor" style="mix-blend-mode:screen" stroke-width="0.548512" stroke-dasharray="1.1 1.1"/>
    <g filter="url(#filter0_d_1_41_fliph)">
      <rect width="18" height="40" rx="0.548512" transform="matrix(-1 0 0 1 45 4)" fill="currentColor"/>
      <rect x="0.274256" y="-0.274256" width="18.5485" height="40.5485" rx="0.822768" transform="matrix(-1 0 0 1 45.5485 4)" stroke="currentColor" stroke-width="0.548512"/>
    </g>
    <line x1="24.5" y1="46" x2="24.5" y2="2" stroke="currentColor"/>
    <defs>
      <filter id="filter0_d_1_41_fliph" x="26.0127" y="3.45148" width="19.9746" height="41.9747" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feFlood flood-opacity="0" result="BackgroundImageFix"/>
        <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
        <feOffset dy="0.43881"/>
        <feGaussianBlur stdDeviation="0.219405"/>
        <feComposite in2="hardAlpha" operator="out"/>
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_41_fliph"/>
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_1_41_fliph" result="shape"/>
      </filter>
    </defs>
  </svg>
</span>
```

## Modificadores de clase

Usa las clases utilitarias del sistema de diseño:

### Tamaños
- `app-icon--xs` (16px)
- `app-icon--sm` (20px)
- `app-icon--md` (24px) - predeterminado
- `app-icon--lg` (32px)
- `app-icon--xl` (48px)

### Colores
- `app-icon--primary` - Color primario del tema
- `app-icon--secondary` - Color secundario
- `app-icon--muted` - Color apagado (medium)

### Estados
- `app-icon--interactive` - Para íconos clicables (con hover y active)

## Ejemplo en Angular/Ionic

```html
<ion-button fill="clear" class="rot-btn" (click)="flipVertical()">
  <span class="app-icon app-icon--md app-icon--interactive" slot="icon-only">
    <svg>...</svg>
  </span>
</ion-button>
```

## Notas técnicas

- Los íconos utilizan `currentColor` para heredar el color del contenedor
- Los filtros SVG tienen IDs únicos para evitar conflictos cuando se usan múltiples íconos
- Todos los íconos están optimizados para 48×48px pero escalan sin pérdida de calidad
- Compatible con modo light/dark automáticamente a través de CSS variables
