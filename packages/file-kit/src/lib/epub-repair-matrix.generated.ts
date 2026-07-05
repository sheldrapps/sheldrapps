export const EPUB_REPAIR_MATRIX_CASES = [
  {
    "id": "CRIT-ZIP-001",
    "severity": "critical",
    "supportedProblem": "El archivo no es ZIP legible.",
    "symptom": "â€œEl archivo no parece ser un EPUB vÃ¡lido.â€",
    "solution": "Intentar lectura parcial de entradas recuperables. Si no se puede listar el contenido, no hay reparaciÃ³n estructural posible.",
    "actionLabel": "Cannot repair",
    "actions": [
      "cannot_repair"
    ],
    "recommendedAction": "cannot_repair"
  },
  {
    "id": "CRIT-ZIP-002",
    "severity": "critical",
    "supportedProblem": "ZIP truncado o directorio central daÃ±ado.",
    "symptom": "EPUB no abre o el anÃ¡lisis se detiene.",
    "solution": "Intentar reconstrucción parcial desde entradas recuperables y volver a diagnosticar el EPUB reparado.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OCF-001",
    "severity": "critical",
    "supportedProblem": "Falta `mimetype`.",
    "symptom": "Muchos lectores rechazan el archivo como EPUB.",
    "solution": "Crear `mimetype` con el valor exacto `application/epub+zip`.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OCF-002",
    "severity": "critical",
    "supportedProblem": "`mimetype` no es la primera entrada del ZIP.",
    "symptom": "Algunos lectores no reconocen el EPUB.",
    "solution": "Reempaquetar: `mimetype` primero.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OCF-003",
    "severity": "critical",
    "supportedProblem": "`mimetype` estÃ¡ comprimido.",
    "symptom": "Error de formato en lectores estrictos.",
    "solution": "Reempaquetar `mimetype` sin compresiÃ³n.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OCF-004",
    "severity": "critical",
    "supportedProblem": "`mimetype` tiene BOM, espacios, salto de lÃ­nea o valor incorrecto.",
    "symptom": "El EPUB parece corrupto.",
    "solution": "Reescribir el contenido exacto en US-ASCII, sin bytes extra.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OCF-005",
    "severity": "critical",
    "supportedProblem": "Falta `META-INF/`.",
    "symptom": "No se puede localizar el package document.",
    "solution": "Crear carpeta; despuÃ©s reconstruir `container.xml`.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-CON-001",
    "severity": "critical",
    "supportedProblem": "Falta `META-INF/container.xml`.",
    "symptom": "El lector no sabe dÃ³nde estÃ¡ el libro interno.",
    "solution": "Buscar OPF candidatos. Si hay uno claro, crear el archivo.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-CON-002",
    "severity": "critical",
    "supportedProblem": "`container.xml` es XML invÃ¡lido.",
    "symptom": "No se puede localizar el OPF.",
    "solution": "Regenerar XML vÃ¡lido usando el OPF localizado.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-CON-003",
    "severity": "critical",
    "supportedProblem": "`container.xml` no tiene `rootfile`.",
    "symptom": "No se encuentra el package document.",
    "solution": "Detectar OPF vÃ¡lido y agregar `rootfile`.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-CON-004",
    "severity": "critical",
    "supportedProblem": "`rootfile@full-path` apunta a archivo inexistente.",
    "symptom": "El EPUB no abre.",
    "solution": "Buscar coincidencia exacta, case-insensitive o por estructura. Si hay una sola, corregir ruta.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-CON-005",
    "severity": "critical",
    "supportedProblem": "Existen varios OPF candidatos.",
    "symptom": "No se sabe cuÃ¡l representa el libro principal.",
    "solution": "Mostrar selector con capÃ­tulos, recursos, nav y spine detectados por cada candidato.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "CRIT-OPF-001",
    "severity": "critical",
    "supportedProblem": "No existe ningÃºn OPF localizable.",
    "symptom": "No hay package document.",
    "solution": "Sin un OPF localizable no hay reparación estructural segura; no reconstruir a ciegas.",
    "actionLabel": "Cannot repair",
    "actions": [
      "cannot_repair"
    ],
    "recommendedAction": "cannot_repair"
  },
  {
    "id": "CRIT-OPF-002",
    "severity": "critical",
    "supportedProblem": "OPF mal formado y no parseable.",
    "symptom": "El EPUB no abre o se rechaza al importar.",
    "solution": "Reparar XML solo si el parser puede reconstruir un Ã¡rbol estable sin descartar contenido relevante.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OPF-003",
    "severity": "critical",
    "supportedProblem": "Falta `<manifest>`.",
    "symptom": "Los recursos no pueden resolverse.",
    "solution": "Reconstruir manifest desde archivos fÃ­sicos, referencias XHTML/CSS y tipos MIME detectados.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-OPF-004",
    "severity": "critical",
    "supportedProblem": "Falta `<spine>`.",
    "symptom": "El lector no sabe quÃ© capÃ­tulos mostrar ni en quÃ© orden.",
    "solution": "Crear spine usando nav/NCX, enlaces, nombres y heurÃ­sticas de capÃ­tulos.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "CRIT-OPF-005",
    "severity": "critical",
    "supportedProblem": "Spine vacÃ­o.",
    "symptom": "EPUB abre sin pÃ¡ginas o sin contenido.",
    "solution": "Reconstruir con XHTML/SVG de lectura detectados.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "CRIT-SPINE-001",
    "severity": "critical",
    "supportedProblem": "`itemref` apunta a un `id` inexistente.",
    "symptom": "CapÃ­tulos desaparecen o el lector falla al avanzar.",
    "solution": "Si hay coincidencia Ãºnica por `href`, corregir el `idref`; si no, quitar la entrada y reportar.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-SPINE-002",
    "severity": "critical",
    "supportedProblem": "CapÃ­tulo del spine no existe fÃ­sicamente.",
    "symptom": "PÃ¡gina en blanco o error de apertura.",
    "solution": "Permitir eliminar capÃ­tulo, sustituir archivo o crear marcador de capÃ­tulo perdido.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "CRIT-SPINE-003",
    "severity": "critical",
    "supportedProblem": "El spine apunta a un recurso no apto para lectura y sin fallback.",
    "symptom": "El lector muestra contenido invÃ¡lido.",
    "solution": "Sustituir por fallback vÃ¡lido, retirar del spine o pedir elecciÃ³n.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "CRIT-XHTML-001",
    "severity": "critical",
    "supportedProblem": "Un capÃ­tulo del spine es XML/XHTML imposible de analizar.",
    "symptom": "El lector puede bloquearse al llegar al capÃ­tulo.",
    "solution": "Intentar normalizaciÃ³n segura; si se perderÃ­a estructura significativa, mostrar vista previa de cambios.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "CRIT-SEC-001",
    "severity": "critical",
    "supportedProblem": "Contenido cifrado con DRM o clave no disponible.",
    "symptom": "El archivo no se puede leer aunque su estructura exista.",
    "solution": "Diagnosticar y conservar estructura; no desbloquear ni eliminar protecciÃ³n.",
    "actionLabel": "Cannot repair",
    "actions": [
      "cannot_repair"
    ],
    "recommendedAction": "cannot_repair"
  },
  {
    "id": "HIGH-OPF-001",
    "severity": "high",
    "supportedProblem": "Atributo `version` ausente o invÃ¡lido.",
    "symptom": "El lector o validador rechaza el package document.",
    "solution": "Inferir EPUB 2 o EPUB 3 segÃºn NCX, nav, propiedades y estructura; normalizar versiÃ³n.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-OPF-002",
    "severity": "high",
    "supportedProblem": "`unique-identifier` ausente.",
    "symptom": "Algunos lectores/catalogadores rechazan el libro.",
    "solution": "Generar UUID nuevo y enlazarlo desde `<package unique-identifier>`.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-OPF-003",
    "severity": "high",
    "supportedProblem": "`unique-identifier` apunta a un ID inexistente.",
    "symptom": "Error de metadatos y validaciÃ³n.",
    "solution": "Apuntar al identificador vÃ¡lido existente o generar uno nuevo.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-001",
    "severity": "high",
    "supportedProblem": "Archivo fÃ­sico referenciado pero ausente del manifest.",
    "symptom": "ImÃ¡genes, CSS o capÃ­tulos no se cargan correctamente.",
    "solution": "Agregar item con `id`, `href` y media type detectado.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-002",
    "severity": "high",
    "supportedProblem": "Recurso declarado en manifest pero inexistente.",
    "symptom": "ImÃ¡genes o capÃ­tulos faltan; error de importaciÃ³n.",
    "solution": "Buscar coincidencia por ruta, case-fold, Unicode normalization, extensiÃ³n o hash parcial.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-003",
    "severity": "high",
    "supportedProblem": "`id` duplicado en manifest.",
    "symptom": "Spine, nav o referencias quedan ambiguas.",
    "solution": "Renombrar IDs secundarios y actualizar todas las referencias OPF.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-004",
    "severity": "high",
    "supportedProblem": "Dos recursos usan el mismo `href`.",
    "symptom": "El lector puede cargar el recurso equivocado.",
    "solution": "Consolidar si son idÃ©nticos; si no, pedir elegir ruta canÃ³nica.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-MAN-005",
    "severity": "high",
    "supportedProblem": "`href` con ruta invÃ¡lida, ruta absoluta o salida fuera del contenedor.",
    "symptom": "Recurso no carga o puede implicar acceso inseguro.",
    "solution": "Normalizar ruta relativa interna; eliminar referencias fuera del contenedor.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-006",
    "severity": "high",
    "supportedProblem": "`media-type` incorrecto en contenido, CSS, imagen, fuente o nav.",
    "symptom": "El lector ignora o interpreta mal recursos.",
    "solution": "Detectar formato por extensiÃ³n y magic bytes; corregir media type.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-007",
    "severity": "high",
    "supportedProblem": "Archivo con extensiÃ³n incorrecta.",
    "symptom": "Recursos no se muestran o validaciÃ³n falla.",
    "solution": "Renombrar, actualizar manifest y todas las referencias internas.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-MAN-008",
    "severity": "high",
    "supportedProblem": "Recurso EPUB 3 con propiedades invÃ¡lidas o faltantes.",
    "symptom": "Nav, portada, scripts o recursos remotos no se interpretan bien.",
    "solution": "Corregir o remover propiedades segÃºn tipo real.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-LINK-001",
    "severity": "high",
    "supportedProblem": "Ruta relativa rota por cambio de mayÃºsculas/minÃºsculas.",
    "symptom": "Imagen, CSS o capÃ­tulo â€œno existeâ€ en Android/Linux.",
    "solution": "Corregir referencia al nombre fÃ­sico real.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-LINK-002",
    "severity": "high",
    "supportedProblem": "Ruta rota por normalizaciÃ³n Unicode distinta.",
    "symptom": "Recurso funciona en un sistema y falla en otro.",
    "solution": "Normalizar rutas y actualizar enlaces.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-LINK-003",
    "severity": "high",
    "supportedProblem": "Enlace interno apunta a archivo inexistente.",
    "symptom": "Links de notas, capÃ­tulos o TOC no funcionan.",
    "solution": "Buscar candidato Ãºnico; si no existe, quitar enlace o crear marcador.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-LINK-004",
    "severity": "high",
    "supportedProblem": "Fragmento `#id` no existe en el documento destino.",
    "symptom": "Tabla de contenido o notas llegan a lugar incorrecto.",
    "solution": "Buscar ID similar, encabezado equivalente o quitar fragmento.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-NAV-001",
    "severity": "high",
    "supportedProblem": "EPUB 3 sin Navigation Document.",
    "symptom": "No aparece tabla de contenido.",
    "solution": "Generar `nav.xhtml` desde spine, headings y landmarks detectables.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-NAV-002",
    "severity": "high",
    "supportedProblem": "Nav existe pero no tiene propiedad `nav` en manifest.",
    "symptom": "Algunos lectores ignoran la navegaciÃ³n.",
    "solution": "AÃ±adir propiedad `nav`.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-NAV-003",
    "severity": "high",
    "supportedProblem": "Hay mÃ¡s de un Navigation Document.",
    "symptom": "NavegaciÃ³n ambigua o invÃ¡lida.",
    "solution": "Elegir uno principal o fusionar solo si las estructuras son compatibles.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "HIGH-NAV-004",
    "severity": "high",
    "supportedProblem": "Falta `toc nav`.",
    "symptom": "TOC no aparece.",
    "solution": "Generar secciÃ³n TOC desde spine/headings.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-NAV-005",
    "severity": "high",
    "supportedProblem": "Entradas del nav apuntan a recursos inexistentes.",
    "symptom": "Ãndice roto.",
    "solution": "Relinkear, eliminar entrada o regenerar TOC completo.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-NCX-001",
    "severity": "high",
    "supportedProblem": "EPUB 2 sin `toc.ncx`.",
    "symptom": "Lectores EPUB 2 no muestran navegaciÃ³n.",
    "solution": "Generar NCX desde spine y headings.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-NCX-002",
    "severity": "high",
    "supportedProblem": "`spine@toc` no apunta a NCX vÃ¡lido.",
    "symptom": "Tabla de contenido desaparece.",
    "solution": "Corregir atributo y MIME del NCX.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-NCX-003",
    "severity": "high",
    "supportedProblem": "NCX con `dtb:uid` inconsistente.",
    "symptom": "ValidaciÃ³n EPUB 2 falla.",
    "solution": "Sincronizar con identificador del package.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-NCX-004",
    "severity": "high",
    "supportedProblem": "NCX con enlaces rotos o `playOrder` invÃ¡lido.",
    "symptom": "TOC parcial o desordenado.",
    "solution": "Corregir targets y regenerar orden secuencial.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-XHTML-001",
    "severity": "high",
    "supportedProblem": "Etiquetas no cerradas o anidamiento XML invÃ¡lido.",
    "symptom": "CapÃ­tulos no abren.",
    "solution": "Parsear como HTML tolerante y reserializar XHTML vÃ¡lido cuando el texto se conserva.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-XHTML-002",
    "severity": "high",
    "supportedProblem": "Atributos sin comillas o caracteres XML prohibidos.",
    "symptom": "Error de parser.",
    "solution": "Escapar, entrecomillar y normalizar.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-XHTML-003",
    "severity": "high",
    "supportedProblem": "Entidades externas, XInclude o DOCTYPE no permitido.",
    "symptom": "El documento falla o genera riesgo de seguridad.",
    "solution": "Eliminar entidades externas/XInclude; normalizar o retirar DOCTYPE.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-XHTML-004",
    "severity": "high",
    "supportedProblem": "IDs duplicados dentro de un capÃ­tulo.",
    "symptom": "Fragment links y referencias fallan.",
    "solution": "Renombrar IDs secundarios y actualizar anchors internos conocidos.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-XHTML-005",
    "severity": "high",
    "supportedProblem": "XHTML vacÃ­o pero presente en spine.",
    "symptom": "PÃ¡gina vacÃ­a, navegaciÃ³n engaÃ±osa.",
    "solution": "Eliminar del spine, crear marcador o pedir sustituciÃ³n.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "HIGH-ENC-001",
    "severity": "high",
    "supportedProblem": "DeclaraciÃ³n de encoding no coincide con los bytes.",
    "symptom": "Texto ilegible o error de parser.",
    "solution": "Detectar encoding, convertir a UTF-8 y actualizar declaraciÃ³n XML/CSS.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-ENC-002",
    "severity": "high",
    "supportedProblem": "Caracteres invÃ¡lidos para XML.",
    "symptom": "CapÃ­tulo no parseable.",
    "solution": "Escapar caracteres vÃ¡lidos o eliminar bytes imposibles, registrando la pÃ©rdida.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "HIGH-FONT-001",
    "severity": "high",
    "supportedProblem": "Fuente obfuscada con referencia inconsistente en `encryption.xml`.",
    "symptom": "TipografÃ­a ilegible o ausente.",
    "solution": "Reconstruir referencia solo si identifier y algoritmo son verificables.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "HIGH-FALLBACK-001",
    "severity": "high",
    "supportedProblem": "Recurso foreign/scripted no tiene fallback vÃ¡lido.",
    "symptom": "El lector puede mostrar blanco o fallar.",
    "solution": "Crear/referenciar fallback disponible o retirar recurso del spine.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-META-001",
    "severity": "medium",
    "supportedProblem": "Falta `dc:title`.",
    "symptom": "El libro aparece sin tÃ­tulo.",
    "solution": "Solicitar tÃ­tulo; proponer nombre del archivo como valor inicial.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-META-002",
    "severity": "medium",
    "supportedProblem": "Falta `dc:language`.",
    "symptom": "Mala clasificaciÃ³n o validaciÃ³n incompleta.",
    "solution": "Selector de idioma con detecciÃ³n inicial por contenido/metadatos.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-META-003",
    "severity": "medium",
    "supportedProblem": "Falta identificador pero el usuario no quiere UUID.",
    "symptom": "El EPUB sigue siendo ambiguo para catÃ¡logo.",
    "solution": "Formulario para valor manual o UUID automÃ¡tico.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-META-004",
    "severity": "medium",
    "supportedProblem": "Falta `dcterms:modified` en EPUB 3.",
    "symptom": "Error de conformidad EPUB 3.",
    "solution": "Insertar fecha UTC actual en formato vÃ¡lido.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-META-005",
    "severity": "medium",
    "supportedProblem": "Fecha invÃ¡lida o vacÃ­a.",
    "symptom": "Error de metadata.",
    "solution": "Normalizar si es parseable; de lo contrario usar fecha actual tras confirmaciÃ³n.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-META-006",
    "severity": "medium",
    "supportedProblem": "Metadatos vacÃ­os, duplicados o con IDs invÃ¡lidos.",
    "symptom": "CatÃ¡logo desordenado o validaciÃ³n deficiente.",
    "solution": "Limpiar valores vacÃ­os, deduplicar y conservar el valor mÃ¡s completo.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-COVER-001",
    "severity": "medium",
    "supportedProblem": "Portada existente pero no marcada correctamente.",
    "symptom": "Miniatura o portada no aparece en lector.",
    "solution": "Detectar imagen usada como cover, agregar `cover-image` o metadata EPUB 2 apropiada.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-COVER-002",
    "severity": "medium",
    "supportedProblem": "Portada referenciada pero la imagen falta.",
    "symptom": "Libro sin miniatura.",
    "solution": "Elegir imagen de reemplazo, usar placeholder o quitar la referencia.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-CSS-001",
    "severity": "medium",
    "supportedProblem": "CSS mal formado.",
    "symptom": "DiseÃ±o roto o parcial.",
    "solution": "Parser CSS tolerante, reserializaciÃ³n y eliminaciÃ³n de reglas corruptas no recuperables.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-CSS-002",
    "severity": "medium",
    "supportedProblem": "CSS referenciado no existe.",
    "symptom": "Texto sin formato.",
    "solution": "Buscar candidato, quitar `<link>` o seleccionar CSS sustituto.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-CSS-003",
    "severity": "medium",
    "supportedProblem": "URL de imagen o fuente dentro de CSS rota.",
    "symptom": "Fondo, icono o fuente faltante.",
    "solution": "Relinkear, eliminar declaraciÃ³n o seleccionar reemplazo.",
    "actionLabel": "Fix / Resolve",
    "actions": [
      "fix",
      "resolve"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-CSS-004",
    "severity": "medium",
    "supportedProblem": "`@font-face` apunta a fuente faltante.",
    "symptom": "TipografÃ­a sustituida o texto invisible.",
    "solution": "Quitar regla, seleccionar fuente local o dejar fallback del sistema.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-CSS-005",
    "severity": "medium",
    "supportedProblem": "CSS codificado en charset incompatible.",
    "symptom": "Caracteres o reglas rotas.",
    "solution": "Transcodificar UTF-8 y normalizar declaraciÃ³n.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-IMG-001",
    "severity": "medium",
    "supportedProblem": "Imagen declarada pero no existe.",
    "symptom": "Imagen faltante.",
    "solution": "Elegir reemplazo, placeholder o remover referencia.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-IMG-002",
    "severity": "medium",
    "supportedProblem": "Imagen tiene MIME incorrecto.",
    "symptom": "Algunos lectores no la muestran.",
    "solution": "Detectar magic bytes y corregir MIME.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-IMG-003",
    "severity": "medium",
    "supportedProblem": "Imagen tiene extensiÃ³n incorrecta pero bytes vÃ¡lidos.",
    "symptom": "Error de validaciÃ³n o render.",
    "solution": "Renombrar archivo y actualizar referencias.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-IMG-004",
    "severity": "medium",
    "supportedProblem": "Imagen corrupta pero parcialmente decodificable.",
    "symptom": "Imagen negra, cortada o no visible.",
    "solution": "Reexportar/recomprimir si el decodificador recupera una imagen vÃ¡lida.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-IMG-005",
    "severity": "medium",
    "supportedProblem": "SVG mal formado.",
    "symptom": "IlustraciÃ³n no aparece.",
    "solution": "Normalizar XML/SVG y eliminar contenido externo no permitido.",
    "actionLabel": "Fix / Review Fix",
    "actions": [
      "fix",
      "review_fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-IMG-006",
    "severity": "medium",
    "supportedProblem": "SVG requiere recurso externo perdido.",
    "symptom": "IlustraciÃ³n incompleta.",
    "solution": "Incrustar recurso si estÃ¡ disponible localmente; de lo contrario quitar o rasterizar si es posible.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-FONT-001",
    "severity": "medium",
    "supportedProblem": "Fuente estÃ¡ en EPUB pero no figura en manifest.",
    "symptom": "Fuente no carga.",
    "solution": "Agregar item con MIME correcto.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-FONT-002",
    "severity": "medium",
    "supportedProblem": "Fuente con MIME incorrecto.",
    "symptom": "ValidaciÃ³n o render deficiente.",
    "solution": "Corregir MIME.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-FONT-003",
    "severity": "medium",
    "supportedProblem": "Fuente faltante.",
    "symptom": "Cambio de tipografÃ­a.",
    "solution": "Quitar regla, elegir fuente o exportar con fallback del sistema.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-RES-001",
    "severity": "medium",
    "supportedProblem": "Recurso remoto detectado.",
    "symptom": "EPUB depende de internet.",
    "solution": "Mantener enlace, eliminarlo o descargarlo solo con consentimiento explÃ­cito.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-RES-002",
    "severity": "medium",
    "supportedProblem": "Propiedad `remote-resources` ausente o incorrecta.",
    "symptom": "Conformidad incompleta.",
    "solution": "Agregar o retirar propiedad segÃºn anÃ¡lisis de recursos.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-SMIL-001",
    "severity": "medium",
    "supportedProblem": "SMIL/Media Overlay ausente para una referencia declarada.",
    "symptom": "NarraciÃ³n sincronizada no funciona.",
    "solution": "Quitar asociaciÃ³n de overlay para mantener lectura de texto.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "MED-SMIL-002",
    "severity": "medium",
    "supportedProblem": "SMIL mal formado.",
    "symptom": "Read-aloud falla.",
    "solution": "Reparar XML si es seguro; de lo contrario desactivar overlay.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-SMIL-003",
    "severity": "medium",
    "supportedProblem": "SMIL apunta a XHTML, fragmento o audio inexistente.",
    "symptom": "SincronizaciÃ³n rota.",
    "solution": "Relinkear si existe candidato; si no, desactivar fragmento/overlay.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "MED-LAYOUT-001",
    "severity": "medium",
    "supportedProblem": "Metadatos de fixed layout inconsistentes.",
    "symptom": "PÃ¡ginas con dimensiones o spreads incorrectos.",
    "solution": "Normalizar metadatos desde la mayorÃ­a de archivos y viewport detectados.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-LAYOUT-002",
    "severity": "medium",
    "supportedProblem": "Viewport ausente o invÃ¡lido en fixed layout.",
    "symptom": "DiseÃ±o fijo se corta o escala mal.",
    "solution": "Inferir dimensiones desde SVG, imagen base o viewport dominante.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "MED-GUIDE-001",
    "severity": "medium",
    "supportedProblem": "`guide` EPUB 2 roto o con referencias invÃ¡lidas.",
    "symptom": "Algunos lectores no abren portada o inicio correctamente.",
    "solution": "Corregir targets o regenerar referencias bÃ¡sicas.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
      {
    "id": "LOW-MAN-001",
    "severity": "low",
    "supportedProblem": "Recurso fÃƒÆ’Ã‚Â­sico huÃƒÆ’Ã‚Â©rfano no usado.",
    "symptom": "Archivo mÃƒÆ’Ã‚Â¡s pesado.",
    "solution": "Detectar referencias reales; permitir eliminar recursos no usados.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
      {
    "id": "LOW-MAN-002",
    "severity": "low",
    "supportedProblem": "Recurso declarado pero nunca usado.",
    "symptom": "Archivo mÃƒÆ’Ã‚Â¡s pesado o manifest ruidoso.",
    "solution": "Permitir remover del manifest y, opcionalmente, del ZIP.",
    "actionLabel": "Fix",
    "actions": [
      "fix"
    ],
    "recommendedAction": "fix"
  },
  {
    "id": "LOW-MAN-003",
    "severity": "low",
    "supportedProblem": "Nombres de archivo con espacios, caracteres poco portables o normalizaciÃ³n inconsistente.",
    "symptom": "Fallos en lectores antiguos.",
    "solution": "Renombrar con confirmaciÃ³n y relinkear todo.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-MAN-004",
    "severity": "low",
    "supportedProblem": "Duplicados binarios idÃ©nticos.",
    "symptom": "EPUB innecesariamente grande.",
    "solution": "Consolidar archivos y actualizar referencias.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-META-001",
    "severity": "low",
    "supportedProblem": "Autor, editorial, sujeto o fecha incompletos.",
    "symptom": "Fichas de biblioteca pobres.",
    "solution": "Formulario opcional de metadatos.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "LOW-META-002",
    "severity": "low",
    "supportedProblem": "Orden o etiquetas de creador inconsistentes.",
    "symptom": "Autor se muestra raro.",
    "solution": "Normalizar `file-as`, roles y refinements cuando haya evidencia.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-NAV-001",
    "severity": "low",
    "supportedProblem": "Etiquetas de TOC vacÃ­as o genÃ©ricas.",
    "symptom": "Ãndice poco usable.",
    "solution": "Inferir desde primer heading o pedir texto.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-NAV-002",
    "severity": "low",
    "supportedProblem": "`page-list` o landmarks incompletos.",
    "symptom": "NavegaciÃ³n secundaria pobre.",
    "solution": "Regenerar solo si hay seÃ±ales suficientes; si no, omitir sin bloquear.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-XHTML-001",
    "severity": "low",
    "supportedProblem": "Estructura HTML semÃ¡nticamente pobre, pero vÃ¡lida.",
    "symptom": "Accesibilidad limitada.",
    "solution": "Sugerencias opcionales; no reescribir agresivamente.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-XHTML-002",
    "severity": "low",
    "supportedProblem": "Enlaces externos HTTP inseguros o rotos.",
    "symptom": "Enlaces fuera del EPUB fallan.",
    "solution": "Mantener, quitar o actualizar a HTTPS cuando exista equivalencia inequÃ­voca.",
    "actionLabel": "Review Fix / Resolve",
    "actions": [
      "review_fix",
      "resolve"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-CSS-001",
    "severity": "low",
    "supportedProblem": "CSS no utilizado.",
    "symptom": "Archivo mÃ¡s pesado.",
    "solution": "Purgar reglas no referenciadas, con vista previa.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-CSS-002",
    "severity": "low",
    "supportedProblem": "Propiedades CSS obsoletas o poco compatibles.",
    "symptom": "Diferencias de render.",
    "solution": "NormalizaciÃ³n conservadora; no cambiar estÃ©tica sin revisiÃ³n.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-CSS-003",
    "severity": "low",
    "supportedProblem": "CSS duplicado.",
    "symptom": "EPUB pesado o difÃ­cil de mantener.",
    "solution": "Consolidar solo si no cambia cascada o especificidad.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-IMG-001",
    "severity": "low",
    "supportedProblem": "Imagen demasiado grande para su uso.",
    "symptom": "EPUB pesado.",
    "solution": "OptimizaciÃ³n opcional, conservando original si la calidad baja.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-IMG-002",
    "severity": "low",
    "supportedProblem": "Imagen sin dimensiones/atributos accesibles.",
    "symptom": "Render o accesibilidad menor.",
    "solution": "AÃ±adir `alt` vacÃ­o para decoraciÃ³n; pedir texto alternativo para imÃ¡genes relevantes.",
    "actionLabel": "Resolve",
    "actions": [
      "resolve"
    ],
    "recommendedAction": "resolve"
  },
  {
    "id": "LOW-FONT-001",
    "severity": "low",
    "supportedProblem": "Fuente no subsetted o no utilizada.",
    "symptom": "EPUB pesado.",
    "solution": "Eliminar o subsetear opcionalmente.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-EPUB2-001",
    "severity": "low",
    "supportedProblem": "EPUB 2 funcional pero con estructura heredada mejorable.",
    "symptom": "Compatibilidad variable en lectores modernos.",
    "solution": "Upgrade opcional a EPUB 3: nav, metadata y normalizaciÃ³n.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-SEC-001",
    "severity": "low",
    "supportedProblem": "Scripts no esenciales o referencias externas inseguras.",
    "symptom": "Riesgo de compatibilidad o seguridad.",
    "solution": "Desactivar o remover tras revisiÃ³n.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  },
  {
    "id": "LOW-REPORT-001",
    "severity": "low",
    "supportedProblem": "Warnings de conformidad sin impacto visible.",
    "symptom": "Ninguno o mÃ­nimo.",
    "solution": "Mostrar en â€œOptional cleanupâ€; no afirmar reparaciÃ³n necesaria.",
    "actionLabel": "Review Fix",
    "actions": [
      "review_fix"
    ],
    "recommendedAction": "review_fix"
  }
] as const;
