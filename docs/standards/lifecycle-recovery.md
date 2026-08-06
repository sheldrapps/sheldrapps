# Estándar de ciclo de vida y recuperación de workflows

Las active mobile (`ccfk`, `ecc`, `ef`, `emas`, `pcm`) registran el ciclo nativo y WebView mediante `@sheldrapps/lifecycle-kit`.

## Diagnóstico

Cada log incluye `session` e `instance`:

```text
adb logcat -s CCFK.Lifecycle:V ECC.Lifecycle:V EF.Lifecycle:V EMAS.Lifecycle:V PCM.Lifecycle:V
```

Una sesión nueva implica process death. Una instancia nueva con la misma sesión implica recreación de `MainActivity`. `pause`/`stop` seguidos de `resume` con los mismos identificadores es una pausa normal. Los logs `[<app>.lifecycle]` correlacionan Activity, Capacitor, Angular, Ionic y anuncios.

## Persistencia

Cada workflow registra un snapshot incremental con `WorkflowRecoveryCoordinator`. Los parámetros se guardan en Preferences bajo `<app>.workflow-recovery.v1`; los binarios se guardan solamente en una carpeta controlada de `Data`. El snapshot no contiene bytes de EPUB/PDF.

El snapshot debe incluir referencias al documento, permisos/URI persistentes cuando existan, paso, portada, crop/zoom/posición/rotación, dimensiones, calidad/opciones, temporales y procesamiento. Al hacer reset intencional se debe llamar `clear()`; `ngOnDestroy` no debe limpiar los temporales que todavía sean necesarios para recuperar el workflow.

## Regresión manual

1. Seleccionar un EPUB/PDF o imagen y avanzar al editor.
2. Mostrar un anuncio y pulsarlo para abrir navegador, Play Store u otra app.
3. Volver con Atrás y comprobar que documento, paso, portada, crop, zoom, rotación, calidad y salida siguen iguales.
4. Repetir con “No conservar actividades” y simulando process death.
5. Repetir cerrando el anuncio sin pulsarlo.
6. Confirmar que volver desde el anuncio no presenta otro App Open Ad.
7. Verificar en logcat que no aparece un segundo `instance` dentro de la misma `session` salvo recreación real y que no hay redirect automático al primer paso.

## Regresión automatizable

- Probar `PersistentRecoveryStore` con un storage falso y `FileKitService` falso.
- Verificar que el JSON contiene referencias y parámetros, pero nunca bytes de documentos.
- Verificar que `clear()` elimina el registro y los temporales controlados.
- Verificar que `WorkflowRecoveryCoordinator.register()` es idempotente y que el guardado se ejecuta una vez por transición a inactivo.
