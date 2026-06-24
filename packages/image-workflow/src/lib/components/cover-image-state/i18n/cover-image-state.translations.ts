export type CoverImageStateFlatDict = Record<string, string>;

export const COVER_IMAGE_STATE_TRANSLATIONS: Record<
  string,
  CoverImageStateFlatDict
> = {
  "en-US": {
    "IMAGE_ERROR_CORRUPT": "The image could not be read. Please try another one.",
    "IMAGE_ERROR_SIZE": "The file is too large. Maximum {{maxSize}} MB.",
    "IMAGE_ERROR_TYPE": "Unsupported format ({{type}}). Please select JPG, PNG, or WebP.",
    "IMAGE_WARN_SMALL": "The image may be too small for some devices.",
    "CREATE.IMAGE_WARN_SMALL": "The image resolution is lower than the selected Kindle model. For better results, use a larger image.",
    "CHANGE.IMAGE_WARN_SMALL": "The image may be too small for some devices.",
    "EXPORT_OPTIONS.SMALL_SOURCE_WARNING": "Your source image is quite small for this crop. The exported cover may look softer.",
    "IMAGE_WARN_INVALID_PDF_COVER": "Invalid PDF cover. Tap to choose a new image.",
    "IMAGE_WARN_INVALID_EPUB_COVER": "Invalid EPUB cover. Tap to choose a new image.",
  },
  "es-MX": {
    "IMAGE_ERROR_CORRUPT": "No se pudo leer la imagen. Prueba con otra.",
    "IMAGE_ERROR_SIZE": "El archivo pesa demasiado. Máximo {{maxSize}} MB.",
    "IMAGE_ERROR_TYPE": "Formato no compatible ({{type}}). Selecciona JPG, PNG o WebP.",
    "IMAGE_WARN_SMALL": "La imagen puede ser demasiado pequeña para algunos dispositivos.",
    "CREATE.IMAGE_WARN_SMALL": "La resolución de la imagen es menor a la del Kindle seleccionado. Para mejores resultados, usa una imagen más grande.",
    "CHANGE.IMAGE_WARN_SMALL": "La imagen puede ser demasiado pequeña para algunos dispositivos.",
    "EXPORT_OPTIONS.SMALL_SOURCE_WARNING": "La imagen original es algo pequeña para este recorte. La portada exportada podría verse menos nítida.",
    "IMAGE_WARN_INVALID_PDF_COVER": "Portada inválida en el PDF. Toca para elegir una nueva imagen.",
    "IMAGE_WARN_INVALID_EPUB_COVER": "Portada inválida en el EPUB. Toca para elegir una nueva imagen.",
  },
};
