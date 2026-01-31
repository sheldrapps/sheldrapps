# Manual de Usuario - Control Presupuestal

**Versión:** 2.0  
**Fecha:** Enero 2026

---

## 📋 Índice

1. [Introducción](#introducción)
2. [Pantalla Principal](#pantalla-principal)
3. [Gestión de Presupuestos](#gestión-de-presupuestos)
4. [Agrupación de Presupuestos](#agrupación-de-presupuestos)
5. [Detalle de Presupuesto](#detalle-de-presupuesto)
6. [Gestión de Gastos](#gestión-de-gastos)
7. [Agrupación de Gastos](#agrupación-de-gastos)
8. [Gestos y Controles](#gestos-y-controles)
9. [Configuración](#configuración)

---

## Introducción

**Control Presupuestal** es una aplicación diseñada para gestionar presupuestos individuales con abonos automáticos programados. Ideal para administrar mesadas, asignaciones familiares o cualquier presupuesto personal con ingresos periódicos.

### Características principales:
- ✅ Múltiples presupuestos independientes
- ✅ Abonos automáticos programables
- ✅ Agrupación de presupuestos
- ✅ Registro de gastos con categorías
- ✅ Avatares personalizados
- ✅ Control de saldo en tiempo real
- ✅ Subtotales por grupo

---

## Pantalla Principal

La pantalla principal muestra todos tus presupuestos organizados por grupos.

### Elementos de la interfaz:

1. **Encabezado de Grupo**: Muestra el nombre del grupo (ej: "EDUCACIÓN", "ENTRETENIMIENTO") o "SIN GRUPO" si los presupuestos no están agrupados.

2. **Tarjeta de Presupuesto**: Cada presupuesto muestra:
   - **Avatar**: Imagen circular personalizada o ícono predeterminado
   - **Nombre**: Nombre del presupuesto
   - **Abono**: Cantidad que se abona automáticamente
   - **Saldo**: Balance actual (verde si positivo, rojo si negativo, gris si cero)

3. **Subtotal de Grupo**: Al final de cada grupo se muestra el subtotal de saldos

4. **Botón "+"**: Botón flotante en la esquina inferior derecha para agregar nuevo presupuesto

### Interpretación de colores:
- 🟢 **Verde**: Saldo positivo (hay dinero disponible)
- 🔴 **Rojo**: Saldo negativo (deuda o sobregiro)
- ⚫ **Gris**: Saldo en cero

---

## Gestión de Presupuestos

### Agregar un Presupuesto

1. Toca el botón **"+"** en la esquina inferior derecha
2. Aparecerá un modal con el título **"Agregar"**
3. Ingresa el **nombre** del presupuesto (ej: "Camila", "Juan", "Fondo Escolar")
4. Toca **"Guardar"**

**Nota**: El presupuesto se crea con el monto de abono predeterminado definido en Ajustes.

### Eliminar un Presupuesto

1. En la lista de presupuestos, **desliza hacia la izquierda** sobre el presupuesto a eliminar
2. Aparecerá un botón rojo con ícono de papelera
3. Toca el botón de eliminar
4. Confirma la eliminación en el diálogo

⚠️ **Advertencia**: Esta acción no se puede deshacer. Se perderán todos los gastos asociados.

---

## Agrupación de Presupuestos

Los grupos te permiten organizar presupuestos relacionados y ver subtotales.

### Asignar un Presupuesto a un Grupo

1. En la lista de presupuestos, **desliza hacia la derecha** sobre el presupuesto
2. Aparecerá un botón azul con ícono de marcapáginas
3. Toca el botón
4. Se mostrará un menú de acción con las siguientes opciones:

#### Opciones disponibles:

**a) Seleccionar grupo existente**:
   - Toca el nombre del grupo deseado
   - El presupuesto se asignará inmediatamente
   - Los grupos existentes muestran un ✓ si el presupuesto ya pertenece a ese grupo

**b) Crear nuevo grupo**:
   - Toca **"Crear nuevo grupo..."**
   - Se abrirá una lista de presupuestos disponibles
   - **Selecciona todos los presupuestos** que deseas incluir en el grupo (usa los checkboxes)
   - Toca **"Siguiente"**
   - Ingresa el **nombre del grupo** (ej: "Educación", "Entretenimiento")
   - Toca **"Crear"**

**c) Quitar de grupo**:
   - Toca **"Sin grupo"**
   - El presupuesto se moverá a la sección "SIN GRUPO"

### Ventajas de Agrupar:
- 📊 Visualiza subtotales por categoría
- 🗂️ Mantén organizados presupuestos relacionados
- 🔍 Identifica rápidamente el estado de cada categoría

---

## Detalle de Presupuesto

Al tocar un presupuesto se abre su pantalla de detalle.

### Elementos de la pantalla:

#### 1. Avatar / Foto
- Toca el avatar o el botón de cámara para **cambiar la imagen**
- Se abrirá el selector de archivos
- Selecciona una imagen de tu galería
- Usa el editor para **recortar en formato cuadrado (1:1)**
- Ajusta zoom y posición
- Toca **"Guardar"** para aplicar los cambios

#### 2. Campos Editables

**Nombre**:
- Toca el campo para editar
- El cambio se guarda automáticamente al perder el foco

**Abono por presupuesto**:
- Cantidad que se abonará automáticamente según la configuración
- Ingresa un valor numérico
- Se aplica en las fechas programadas

#### 3. Tarjeta de Saldo

Muestra el **saldo actual** con colores:
- Verde: saldo positivo
- Rojo: saldo negativo
- Gris: saldo en cero

**Botones**:
- **"Agregar gasto"**: Registra un nuevo gasto
- **"Editar saldo"**: Ajusta manualmente el saldo (útil para correcciones)

#### 4. Lista de Gastos

Los gastos se muestran agrupados por categoría.

**Cada gasto muestra**:
- Descripción del gasto
- Monto (en rojo con signo negativo)

**Al final de cada grupo**:
- **Subtotal**: Suma de gastos de esa categoría

---

## Gestión de Gastos

### Agregar un Gasto

1. En la pantalla de detalle del presupuesto, toca **"Agregar gasto"**
2. Aparecerá un diálogo
3. Ingresa:
   - **Concepto**: Descripción del gasto (ej: "Útiles escolares", "Cine")
   - **Monto**: Cantidad gastada
4. Toca **"Guardar"**

El gasto se registra y el saldo se actualiza automáticamente restando el monto.

### Editar un Gasto

1. Toca el gasto en la lista
2. Aparecerá un diálogo de edición
3. Modifica el concepto
4. Toca **"Guardar"**

### Eliminar un Gasto

1. **Desliza hacia la izquierda** sobre el gasto
2. Aparecerá un botón rojo con ícono de papelera
3. Toca el botón de eliminar
4. El gasto se elimina y el saldo se ajusta automáticamente

---

## Agrupación de Gastos

Puedes organizar gastos en categorías (ej: "Alimentación", "Transporte", "Diversión").

### Asignar un Gasto a una Categoría

1. En la lista de gastos, **desliza hacia la derecha** sobre el gasto
2. Aparecerá un botón azul con ícono de marcapáginas
3. Toca el botón
4. Aparecerá un diálogo de texto
5. Ingresa el **nombre de la categoría**
6. Toca **"Guardar"**

**Nota**: Si la categoría ya existe, el gasto se agregará automáticamente. Si es nueva, se creará.

### Quitar Categoría a un Gasto

1. Sigue los pasos anteriores
2. En el diálogo, **deja el campo vacío**
3. Toca **"Sin grupo"** o **"Guardar"**
4. El gasto se moverá a "SIN GRUPO"

### Beneficios:
- 📊 Visualiza cuánto gastas por categoría
- 🧮 Subtotales automáticos por grupo
- 📈 Mejor control de hábitos de gasto

---

## Gestos y Controles

La aplicación utiliza gestos táctiles para agilizar la interacción:

### Swipe (Deslizar)

#### 🟦 Deslizar hacia la DERECHA:
- **En presupuesto**: Asignar a grupo
- **En gasto**: Asignar categoría

#### 🟥 Deslizar hacia la IZQUIERDA:
- **En presupuesto**: Eliminar presupuesto
- **En gasto**: Eliminar gasto

### Tap (Tocar)

#### Toque simple:
- **En presupuesto**: Abrir detalle
- **En gasto**: Editar descripción
- **En avatar**: Cambiar imagen
- **En campo de texto**: Editar

#### Toque en botones:
- **Botón "+"**: Agregar presupuesto
- **"Agregar gasto"**: Registrar nuevo gasto
- **"Editar saldo"**: Ajustar saldo manualmente

### Consejos de Uso:
- Los swipes no necesitan ser completos, un movimiento corto es suficiente
- Los botones de acción (eliminar, agrupar) aparecen inmediatamente al deslizar
- Si deslizas por error, toca fuera del elemento para cancelar

---

## Configuración

Accede a la configuración desde el menú principal.

### Opciones disponibles:

#### 1. Monto de Abono Predeterminado
Define la cantidad que se asignará por defecto al crear un nuevo presupuesto.

#### 2. Días de Abono
Configura los días del mes en que se realizan los abonos automáticos.

**Ejemplos**:
- `15, 30`: Abona los días 15 y fin de mes
- `1`: Abona el primer día de cada mes
- `7, 14, 21, 28`: Abonos semanales

#### 3. Ajuste Especial de Febrero
Activa/desactiva el ajuste para el mes de febrero.

**Razón**: Febrero tiene menos días (28 o 29), por lo que puedes configurar un día específico para el abono final del mes.

#### 4. Día de Abono en Febrero
Si el ajuste está activado, define qué día usar para el último abono de febrero (típicamente el 28).

### Funcionamiento de Abonos Automáticos:

La aplicación revisa automáticamente las fechas configuradas y:
1. **Abona** el monto correspondiente a cada presupuesto
2. **Limpia** los gastos registrados (se resetean)
3. **Actualiza** el saldo con el nuevo abono

**Importante**: Los abonos se aplican cuando abres la aplicación. Si no la abres durante varios períodos, se aplicarán todos los abonos pendientes acumulados.

---

## Preguntas Frecuentes

### ¿Los gastos se guardan después de un abono?
No. Cuando se aplica un abono automático, la lista de gastos se limpia. Solo se conserva el saldo actualizado.

### ¿Puedo ajustar el saldo manualmente?
Sí. En la pantalla de detalle, usa el botón **"Editar saldo"** para hacer ajustes manuales.

### ¿Qué pasa si elimino un presupuesto?
Se pierde toda la información asociada: gastos, saldo, historial. Esta acción no se puede deshacer.

### ¿Puedo mover varios presupuestos a un grupo a la vez?
Sí. Cuando creas un **nuevo grupo**, puedes seleccionar múltiples presupuestos desde la lista con checkboxes.

### ¿Los grupos de gastos y presupuestos están relacionados?
No. Son sistemas independientes:
- **Grupos de presupuestos**: Organizan presupuestos completos
- **Categorías de gastos**: Organizan gastos dentro de un presupuesto específico

### ¿Cómo cambio el nombre de un grupo?
Actualmente no hay función de renombrar. Debes:
1. Quitar los presupuestos del grupo (asignarlos a "Sin grupo")
2. Crear un nuevo grupo con el nombre correcto
3. Asignar los presupuestos al nuevo grupo

### ¿Por qué aparece un aviso de seguridad al instalar?
Si instalas la versión de desarrollo (APK debug), es normal que Google Play Protect muestre una advertencia. Para uso en producción, la app debe estar firmada y publicada en Play Store.

---

## Soporte y Contacto

**Desarrollador**: Sheldrapps  
**Versión de la App**: 2.0  
**Compatibilidad**: Android 7.0+

---

## Registro de Cambios

### Versión 2.0 (Enero 2026)
- ✨ Nuevo: Agrupación de presupuestos
- ✨ Nuevo: Avatares/fotos personalizadas (editor 1:1)
- ✨ Nuevo: Subtotales por grupo
- ✨ Nuevo: Modal mejorado para crear grupos con selección múltiple
- ✨ Nuevo: Agrupación de gastos por categoría
- 🔄 Cambio: Terminología "niños" → "presupuestos"
- 🔄 Cambio: Gestos swipe optimizados
- 🎨 Mejora: Interfaz actualizada con mejor alineación
- 🐛 Corrección: Problema del teclado al crear grupos
- 🐛 Corrección: Identación de encabezados de grupo

### Versión 1.0
- Versión inicial con gestión básica de presupuestos

---

**¡Gracias por usar Control Presupuestal!**

Para más información o reportar problemas, contacta al desarrollador.
