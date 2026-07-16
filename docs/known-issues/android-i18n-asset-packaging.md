# Android i18n Asset Packaging

## Sintomas

- En Android se ven las translation keys en vez del texto traducido.
- En web las traducciones si funcionan.
- El problema aparece despues de instalar o reinstalar el APK.

## Causa Verificada

El problema no era el contenido de i18n, sino el empaquetado Android: `www/assets/i18n/*.json` existia, pero `android/app/src/main/assets/public/assets/i18n/*.json` no estaba presente en el paquete final.

## Reparacion Real

- Rehacer el copiado/sync de assets web hacia Android.
- Verificar explicitamente que los JSON de i18n existan dentro de `android/app/src/main/assets/public/assets/i18n/`.
- Tratar el caso como error de packaging hasta confirmar esa carpeta, no como problema de traducciones.

## Checklist

- Verificar `www/assets/i18n/*.json`.
- Verificar `android/app/src/main/assets/public/assets/i18n/*.json`.
- Reinstalar el APK solo despues de confirmar ambos puntos.
- Si Android sigue mostrando keys, revisar primero assets empaquetados antes de editar locales.
