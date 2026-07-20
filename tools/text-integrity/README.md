# Text Integrity

Detecta dos capas distintas:

1. UTF-8 inválido a nivel de bytes.
2. Mojibake semántico dentro de texto que ya es UTF-8 válido.

## Por qué existe

Un archivo puede ser `utf-8` técnicamente válido y aun así estar corrupto:

- `ConfiguraciÃƒÂ³n`
- `Donâ€™t`
- `â€œTextoâ€`
- `ðŸš€`

Eso suele pasar cuando UTF-8 se leyó como Windows-1252 o Latin-1, o cuando se recodificó más de una vez.

## Comandos

- `pnpm text-integrity`
- `pnpm text-integrity --verbose`
- `pnpm text-integrity --suggest`
- `pnpm text-integrity --fix`
- `pnpm text-integrity --staged`
- `pnpm text-integrity --changed`
- `pnpm text-integrity --path apps/epub-fixer`
- `pnpm text-integrity --format json`

## Modos

- Modo normal: nunca escribe archivos.
- `--suggest`: muestra propuestas de reparación.
- `--fix`: solo aplica hallazgos de confianza alta.
- `--staged`: analiza archivos staged de Git.
- `--changed`: analiza archivos modificados del working tree.

## Reparación

La reparación:

- intenta reinterpretar fragmentos dañados como Windows-1252 o Latin-1 y redecodificarlos como UTF-8 estricto,
- limita iteraciones,
- exige mejora clara de puntuación,
- rechaza candidatos con `U+FFFD` o controles C1,
- no toca hallazgos de confianza media o baja.

`fix(fix(text)) === fix(text)` debe mantenerse.

## Excepciones

Si necesitas permitir BOM o C1 en una ruta concreta, ajusta [config.ts](C:/apps/sheldrapps/tools/text-integrity/config.ts:1) con justificación explícita.

## Añadir patrones

Amplía las secuencias fuertes en:

- [repair.ts](C:/apps/sheldrapps/tools/text-integrity/repair.ts:1)
- [detect.ts](C:/apps/sheldrapps/tools/text-integrity/detect.ts:1)

Hazlo siempre con tests nuevos que prueben:

- caso corrupto detectado
- caso válido no marcado
- reparación segura o rechazo seguro
