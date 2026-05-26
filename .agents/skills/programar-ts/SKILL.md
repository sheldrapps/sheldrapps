---
name: programar-ts
user-invocable: true
description: "Implementar/refactorizar TypeScript con calidad de producción en primera pasada: SOLID, SRP, Clean Code, Clean Architecture, separación TS/HTML/SCSS, i18n por keys. Use when user asks TS implementation/refactor, clean-architecture boundaries, or feature code without post-cleanup pass."
---

# Programar En TypeScript (Clean By Default)

## Activación

Usar esta skill cuando el usuario pida implementar, refactorizar o extender código TypeScript.

## Regla principal

Generar código limpio desde la entrada.
No aplicar enfoque "hacer rápido y corregir después".
No dejar deuda evitable para una segunda pasada.

## Estándar obligatorio

- SOLID completo.
- SRP estricto por clase y función.
- Clean Code: nombres claros, funciones pequeñas, bajo acoplamiento.
- Clean Architecture: dominio separado de framework/IO.
- Dependencias hacia adentro (inversión de dependencias cuando aplique).

## Reglas de estructura

- No mezclar template o estilos inline dentro de `.ts`.
- Componentes Angular deben usar:
  - `templateUrl`
  - `styleUrls`
- No crear carpeta `views`; usar `components`.
- No agregar SCSS nuevo en apps salvo excepción justificada.
- Reusable first: si hay potencial cross-app, extraer a `packages/*`.

## Reglas de diseño de código

- Una responsabilidad por módulo/componente/servicio.
- Evitar funciones largas y anidadas.
- Evitar branching profundo; preferir composición.
- Evitar estado compartido implícito.
- Evitar nombres genéricos (`data`, `temp`, `helper`, `utils` ambiguo).
- Cada cambio debe dejar el código más simple que antes.

## Reglas de estilo de salida de código

- No agregar comentarios dentro del código, salvo que el usuario lo pida explícitamente.
- No agregar emojis en código, logs ni textos de salida.
- No hardcodear textos de UI: usar i18n keys.
- No introducir cadenas mágicas repetidas; extraer constantes con nombre semántico.

## i18n obligatorio

Para cualquier texto UI nuevo:

- usar keys de traducción,
- actualizar todos los locales soportados del app/kit afectado,
- mantener UTF-8 correcto (sin mojibake, sin `\uXXXX` en values),
- en kits reusable, preferir traducciones internas standalone host-safe.

## Kits-first (monorepo)

Antes de codificar en `apps/*`, revisar si corresponde a kit:

- UI/tokens -> `packages/ui-theme`
- settings/persistencia -> `packages/settings-kit`
- archivos/share -> `packages/file-kit`
- ads/consent -> `packages/ads-kit`
- image workflow/editor -> `packages/image-workflow`
- recommended apps -> `packages/recommended-apps`

Si hay patrón repetible, promover a kit en la misma tarea o reportar bloqueo.

## Guardrails de implementación

- No romper contrato público existente sin necesidad.
- Minimizar diff y mantener compatibilidad hacia atrás cuando sea posible.
- Evitar refactors oportunistas fuera de scope.
- Si falta contexto para una decisión de alto impacto, pausar y preguntar 1 bloqueo claro.

## Validación mínima

1. Validación local del área tocada:
   - `pnpm --filter <app-or-package> lint`
   - `pnpm --filter <app-or-package> build`
2. Al cierre (cuando aplique):
   - `pnpm test`
   - `pnpm lint`
   - `pnpm build`

## Checklist de calidad antes de cerrar

- código cumple SOLID/SRP,
- no hay inline template/styles en `.ts`,
- no hay comentarios agregados en código,
- no hay emojis,
- i18n aplicado en todo texto UI,
- extracción a kit evaluada y aplicada cuando corresponde,
- complejidad reducida o al menos no incrementada injustificadamente.

## Formato de reporte esperado

Reportar siempre:

- archivos cambiados,
- comandos ejecutados y estado pass/fail,
- riesgos pendientes o siguientes pasos.

No pegar archivos completos salvo que el usuario lo pida.
