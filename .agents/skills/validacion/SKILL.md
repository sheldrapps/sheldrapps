---
name: validacion
user-invocable: true
description: "Validates completed TS/UI changes with lint, test, build, and i18n or encoding checks. Use when a change is done, after UI or strings edits, or before marking the task complete."
---

# Validación (post-integración TS/UI)

## Activación

Usar esta skill después de integrar cambios en TypeScript, UI o strings.

## Flujo obligatorio

1. Ejecutar validación local del scope tocado:
   - `pnpm --filter <app-or-package> lint`
   - `pnpm --filter <app-or-package> test` (si existe)
   - `pnpm --filter <app-or-package> build`
2. Ejecutar validación global al cierre:
   - `pnpm test`
   - `pnpm lint`
   - `pnpm build`

## Clasificación de errores

### A. Error de regresión

Tratar como regresión cuando el fallo indica cambio no intencional de comportamiento previo:

- tests existentes que antes protegían comportamiento esperado y ahora fallan,
- contratos públicos/flujo funcional roto,
- cambios UI que rompen layout/semántica esperada,
- cambios de texto/i18n que eliminan claves esperadas.

Acción obligatoria:

- pausar y preguntar al usuario una sola decisión:
  - ¿cambiar el comportamiento esperado?, o
  - ¿mantener comportamiento anterior y corregir bug?

Si el usuario elige mantener comportamiento anterior, corregir como bug y restablecer compatibilidad.

### B. Error normal (no regresión)

Ejemplos:

- errores de tipos/imports,
- lint violations,
- fallos mecánicos de build,
- wiring incompleto sin cambio de comportamiento previo.

Acción obligatoria:

- reparar sin preguntar,
- volver a correr validaciones hasta pasar.

## Cuando no hay errores

Si todo pasa en lint/test/build:

- agregar o reforzar mecanismos de no-regresión,
- listado no limitado a:
  - unit tests de comportamiento clave,
  - tests de integración del flujo tocado,
  - asserts para contratos públicos,
  - validaciones de i18n donde aplique.

Objetivo: el cambio no debe quedar solo "verde", debe quedar protegido ante regresiones futuras.

## Reglas específicas para UI/strings

Si se modificó UI o textos:

1. Verificar que las traducciones existan en todos los idiomas soportados por la app host.
2. Ejecutar primero los mecanismos ya existentes:
   - `pnpm sync:i18n:check`
   - `pnpm text-integrity --changed`
   - o `pnpm text-integrity --staged` si el flujo es de staging
3. Recordar siempre:
   - UTF-8 válido no implica texto sano
   - mojibake válido como `ConfiguraciÃ³n` o `DonÃ¢â‚¬â„¢t` debe tratarse como fallo
4. Si `text-integrity` reporta hallazgos de confianza alta:
   - no declarar éxito
   - mostrar sugerencias
   - corregir y volver a ejecutar validación completa
5. Solo ejecutar `pnpm text-integrity --fix` cuando el usuario o la tarea lo pidan explícitamente.
6. Después de cualquier reparación:
   - volver a correr `pnpm sync:i18n:check`
   - volver a correr `pnpm text-integrity --changed` o `--staged`
   - verificar que JSON/XML sigan siendo válidos
7. Está prohibido "arreglar" mojibake con reemplazos globales manuales de `Ãƒ`, `Ã‚` o `Ã¢`.

## Definition Of Done (skill)

No cerrar hasta cumplir:

- lint/test/build en verde,
- regresiones tratadas con decisión explícita del usuario,
- errores normales reparados,
- no-regresión reforzada con tests/mecanismos nuevos,
- i18n completo y sin mojibake cuando hubo cambios UI/strings.

## Entrega

Entregar resumen breve con:

- resultado de validaciones,
- clasificación de errores y resolución,
- riesgos pendientes.
