# Presupuesto para Niños

Aplicación Ionic Angular standalone para enseñar a niños a administrar su presupuesto.

## Desarrollo

```bash
# Iniciar servidor de desarrollo
pnpm dev:presupuesto

# Compilar para producción
pnpm build:presupuesto

# Ejecutar linter
pnpm lint:presupuesto
```

## Estructura

- Arquitectura standalone de Angular
- Ionic Framework 8
- Providers explícitos para i18n, settings y file-kit
- Idioma único: es-MX
- AppId: com.sheldrapps.presupuestoninos

## Paquetes utilizados

- `@sheldrapps/i18n-kit` - Internacionalización
- `@sheldrapps/settings-kit` - Gestión de configuración
- `@sheldrapps/file-kit` - Manejo de archivos
- `@sheldrapps/ui-theme` - Tema compartido

## Manual básico de uso

### Inicio (Presupuestos)
- Lista de niños con su saldo y abono.
- Botón flotante “+” para agregar un niño.
- Toca un niño para entrar a su detalle.

### Agregar niño
- Ingresa nombre y género.
- Se crea con saldo y abono configurables.

### Detalle del niño
- Edita nombre y género.
- Ajusta el “Abono por niño”.
- Saldo actual destacado.
- “Agregar gasto” descuenta del saldo.
- “Editar saldo” permite corregir manualmente (acepta valores negativos).

### Gastos
- Lista con montos negativos.
- Desliza un gasto para borrar.

### Configuración (Ajustes)
- Define abono por defecto.
- Define días de abono (ej. 15,30).
- Regla especial de febrero con día configurable.
- “Recalcular abonos” aplica abonos pendientes.

### Notas
- Todo se guarda automáticamente.
- Moneda en MXN con 2 decimales.
