export type CoverImageStateFlatDict = Record<string, string>;

export const COVER_IMAGE_STATE_TRANSLATIONS: Record<
  string,
  CoverImageStateFlatDict
> = {
  "en-US": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Current cover",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Tap to preview",
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
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Portada actual",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Toca para previsualizar",
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
  "ar-SA": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "الغلاف الحالي",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "اضغط لعرض المعاينة",
  },
  "de-DE": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Aktuelles Cover",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Zum Anzeigen tippen",
  },
  "fr-FR": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Couverture actuelle",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Touchez pour prévisualiser",
  },
  "hi-IN": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "वर्तमान कवर",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "पूर्वावलोकन देखने के लिए टैप करें",
  },
  "it-IT": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Copertina attuale",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Tocca per visualizzare l’anteprima",
  },
  "ja-JP": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "現在の表紙",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "タップでプレビュー表示",
  },
  "ko-KR": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "현재 표지",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "탭하여 미리보기",
  },
  "pt-BR": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Capa atual",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Toque para ver a prévia",
  },
  "ru-RU": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "Текущая обложка",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "Коснитесь, чтобы открыть предпросмотр",
  },
  "zh-CN": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "当前封面",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "点击查看预览",
  },
  "zh-TW": {
    "IMAGE_WORKFLOW.PREVIEW_TITLE": "目前封面",
    "IMAGE_WORKFLOW.TAP_TO_PREVIEW": "點擊查看預覽",
  },
};
