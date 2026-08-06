# HOWTO: Spinner reactivo con signals

## Objetivo

Todos los loaders de las active deben usar `SpinnerComponent` desde `@sheldrapps/ui-theme` y cerrar su estado por evento de finalización de la operación. El spinner no debe depender de timeouts, `requestAnimationFrame` ni listeners usados solo para ocultarlo.

## Componente

Usar:

```html
<sh-spinner
  [visible]="isExporting"
  variant="fullscreen"
  [label]="'COMMON.LOADING' | translate"
  [detail]="progressLabel"
  [progress]="progressPercent"
></sh-spinner>
```

`SpinnerComponent` vive en `packages/ui-theme/src/lib/components/spinner/` y ofrece:

- Crescent como indicador único.
- Colores heredados del tema mediante tokens Ionic/app.
- Variantes `inline`, `indicator`, `overlay` y `fullscreen`.
- `label`, `detail` y `progress` opcionales.
- `role="status"` y `role="progressbar"` cuando corresponde.
- Renderizado controlado únicamente por `[visible]`.

## Estado local con signal

Cuando el código existente usa el nombre booleano en muchos lugares, conservar la API booleana con un signal privado:

```ts
private readonly exportBusyState = signal(false);

get isExporting(): boolean {
  return this.exportBusyState();
}

set isExporting(value: boolean) {
  this.exportBusyState.set(value);
}
```

El getter permite que el template registre la dependencia reactiva y el setter mantiene compatibles los callbacks existentes de Capacitor, Canvas, filesystem y plugins.

Si no hace falta compatibilidad con una propiedad booleana, preferir directamente:

```ts
readonly isLoading = signal(false);
```

```html
<sh-spinner [visible]="isLoading()" variant="inline"></sh-spinner>
```

## Ciclo obligatorio

Toda operación asíncrona debe activar y cerrar el estado en el mismo flujo:

```ts
async onGenerate(): Promise<void> {
  this.isExporting = true;

  try {
    await this.generateCover();
  } finally {
    this.isExporting = false;
  }
}
```

El `finally` debe existir aunque la acción tenga varios `return`, errores de validación, cancelaciones o errores nativos. No usar un timeout para apagar el spinner.

Para operaciones concurrentes o anidadas, separar los estados (`isPicking`, `isExporting`, `isRebuildingExportQuality`, etc.) o usar un contador/señal de tareas. No reutilizar una bandera si dos acciones pueden ejecutarse simultáneamente.

## Inputs de kits

Los componentes reutilizables que reciben el estado de carga deben declarar inputs reactivos:

```ts
readonly loading = input(false);
```

```html
@if (loading()) {
  <sh-spinner [visible]="true" variant="indicator"></sh-spinner>
}
```

La API pública del template sigue siendo `[loading]="loadingState"`; solo cambia la lectura interna a `loading()`.

## Progreso

El progreso debe actualizarse desde el evento real de la operación:

```ts
this.progressPercent = event.percent;
```

```html
<sh-spinner
  [visible]="isNativeRewriteInProgress"
  variant="fullscreen"
  [progress]="progressPercent"
></sh-spinner>
```

`SpinnerComponent` normaliza el valor al rango `0..100`. La terminación del loader debe ocurrir en el evento de éxito, error o cancelación, no al alcanzar un tiempo estimado.

## Auditoría de las active

El patrón está aplicado a los loaders de CCFK, ECC, PCM, EF, EMAS, JOS, Presupuesto y los kits compartidos. Al agregar una operación nueva, comprobar que el estado se active al comenzar y se desactive en `finally` o en todos los eventos terminales.

## Checklist

- [ ] El template usa `sh-spinner` y no `ion-loading` ni `ion-spinner` directo.
- [ ] La visibilidad proviene de un signal, un getter respaldado por signal o un input signal.
- [ ] La acción activa el loader antes de comenzar.
- [ ] La acción lo apaga en `finally` o en todos los eventos terminales.
- [ ] Error y cancelación también apagan el loader.
- [ ] No hay timeout para ocultarlo.
- [ ] El progreso proviene de eventos reales.
- [ ] El build y lint del app host pasan.
