# create-ionic-app Scaffold Drift

## Sintomas

- Una app nueva sale con logica de dominio que nadie pidio.
- Se copian tabs, servicios o rutas de otra app del repo solo por parecerse al nombre o al caso de uso.
- El scaffold registra `file-kit`, editor, puertos EPUB o rutas de recommended apps aunque la app solo necesitaba tabs vacias.

## Causa Verificada

La skill `create-ionic-app` no estaba suficientemente neutral y permitia arrastrar wiring de apps existentes en vez de generar una base vacia.

## Reparacion Real

- El scaffold base debe crear tabs vacias y pages vacias.
- No copiar logica, servicios, assets, rutas o workflows de otra app por similitud.
- No registrar providers de dominio (`file-kit`, puertos EPUB, editor, recommended-apps, workflows heredados) salvo pedido explicito.
- Tratar capacidades de dominio como opt-in, no como default.

## Reparacion Aplicada En Repo

La skill `C:\apps\sheldrapps\.agents\skills\create-ionic-app\SKILL.md` ahora documenta:

- scaffold neutral por defecto
- tabs vacias sin logica de dominio
- no inferir editor ni file flows por similitud
- no registrar providers de dominio salvo pedido explicito
- inicializacion correcta de `EdgeToEdgeService` antes de `ThemeService.initialize()`

## Checklist

- Si el usuario solo pidio tabs, entregar tabs y placeholders.
- Antes de cerrar el scaffold, revisar que no existan imports o rutas de dominio no solicitadas.
- Confirmar que `main.ts` o bootstrap compartido no registren providers no pedidos.
