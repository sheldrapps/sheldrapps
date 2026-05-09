const BASE_TRANSLATION = {
  BEST_CANDIDATE: {
    ACTION: {
      DETECT_COVER: 'Detect cover automatically',
    },
    LOADING: {
      TITLE: 'Searching for candidate images...',
    },
    EMPTY: {
      TITLE: 'No cover candidates found',
      DESCRIPTION: 'We could not find useful images inside this EPUB.',
    },
    PICKER: {
      TITLE: 'Choose a possible cover',
      DESCRIPTION: 'We found images that may work as the book cover.',
      LONG_PRESS_HINT: 'Long press an image to preview it.',
      NO_COVER_DETECTED:
        'No cover detected, tap to select one of the suggestions.',
      LONG_PRESS_TO_PREVIEW: 'Long press to preview.',
      UNKNOWN_IMAGE: 'Unknown image',
      CANDIDATE_ALT: 'Candidate image {{index}}',
    },
    REASON: {
      FIRST_LARGE_IMAGE: 'First large image',
      COVER_RATIO: 'Cover-like ratio',
      NEAR_BOOK_START: 'Near the beginning',
      FILENAME_COVER: 'Cover-like filename',
      LARGE_RESOLUTION: 'Large image',
      METADATA_COVER: 'Marked as cover metadata',
      SMALL_ICON_RISK: 'May be icon-like',
      DECORATIVE_RISK: 'May be decorative',
    },
    PREVIEW: {
      TITLE: 'Image preview',
      OPEN: 'Preview',
      CLOSE: 'Close',
      SELECT: 'Use this image',
    },
  },
} as const;

export const BEST_CANDIDATE_KIT_TRANSLATIONS = {
  'ar-SA': BASE_TRANSLATION,
  'de-DE': BASE_TRANSLATION,
  'en-US': BASE_TRANSLATION,
  'es-MX': BASE_TRANSLATION,
  'fr-FR': BASE_TRANSLATION,
  'hi-IN': BASE_TRANSLATION,
  'it-IT': BASE_TRANSLATION,
  'ja-JP': BASE_TRANSLATION,
  'ko-KR': BASE_TRANSLATION,
  'pt-BR': BASE_TRANSLATION,
  'ru-RU': BASE_TRANSLATION,
  'zh-CN': BASE_TRANSLATION,
  'zh-TW': BASE_TRANSLATION,
} as const;
