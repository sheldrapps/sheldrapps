# ECC: regreso desde enlace externo de AdMob

## Logs temporales

En un APK debug:

```powershell
adb logcat -c
adb logcat -s ECC.Lifecycle:V EpubRewritePlugin:V
```

En la consola WebView se buscan las entradas `[ECC.lifecycle]`. Todas incluyen
`session` e `instance`.

- misma `session` y mismo `instance`: pausa/reanudación normal;
- misma `session` y nuevo `instance`: Activity destruida y recreada;
- nueva `session`: proceso eliminado y vuelto a crear;
- nueva secuencia `Angular.bootstrap`/`ChangePage.ngOnInit` con Activity estable:
  reinicialización de Angular/Ionic.

El plugin de AdMob 8 no expone callback de click/open. El clic externo queda
correlacionado por `RewardedVideoAdShowed` seguido de `MainActivity.onPause`; sí
se registran shown, rewarded, dismissed, load-failed y show-failed.

## Prueba manual

1. Seleccionar un EPUB, elegir la portada y avanzar al editor.
2. Cambiar crop, zoom, posición, rotación, formato y calidad; llegar a Crear.
3. Mostrar el anuncio recompensado y pulsar su enlace para abrir navegador,
   Google Play u otra app.
4. Volver con Atrás. Confirmar que EPUB, portada, paso, crop y opciones siguen
   iguales y que no aparece otro App Open Ad.
5. Repetir con `No conservar actividades` activado.
6. Repetir con el proceso detenido mientras la app está fuera de pantalla:

   ```powershell
   adb shell am force-stop com.sheldrapps.epubcoverchanger
   adb shell monkey -p com.sheldrapps.epubcoverchanger 1
   ```

   El recovery debe reconstruir el flujo desde `Data/EPUBCoverChangerWork` y
   `Preferences`; el EPUB no se serializa en `savedInstanceState`.
7. Repetir cerrando el anuncio sin pulsar su enlace. El resultado debe ser el
   mismo y no debe iniciarse un anuncio adicional al volver.

## Regresión automatizada

```powershell
cmd /c pnpm --filter epub-cover-changer exec ng test --watch=false --browsers=ChromeHeadlessNoGpu --include "src/app/services/ecc-editor-recovery.service.spec.ts"
```

La prueba verifica que el snapshot conserva referencias, URI SAF, permisos,
crop y archivos de imagen controlados, sin incrustar bytes del EPUB en el
registro persistente.
