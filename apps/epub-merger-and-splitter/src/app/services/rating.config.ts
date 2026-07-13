import type {
  RatingFeedbackOption,
  RatingTranslationOverrides,
} from '@sheldrapps/rating-kit';

export const EPUB_MERGER_AND_SPLITTER_RATING_FEEDBACK_OPTIONS: readonly RatingFeedbackOption[] =
  [
    {
      id: 'file_not_saved',
      labelKey: 'RATING.EPUB_MERGER_AND_SPLITTER_FEEDBACK.OPTIONS.NO_ISSUE_FOUND',
      fallbackLabel: 'No issue found',
    },
    {
      id: 'file_not_found',
      labelKey: 'RATING.EPUB_MERGER_AND_SPLITTER_FEEDBACK.OPTIONS.NOT_REPAIRED',
      fallbackLabel: 'I could not find the EPUB',
    },
    {
      id: 'image_blurry',
      labelKey: 'RATING.EPUB_MERGER_AND_SPLITTER_FEEDBACK.OPTIONS.STILL_BROKEN',
      fallbackLabel: 'Merge or split failed',
    },
    {
      id: 'app_crashed',
      labelKey: 'RATING.EPUB_MERGER_AND_SPLITTER_FEEDBACK.OPTIONS.APP_CLOSED',
      fallbackLabel: 'App crashed',
    },
    {
      id: 'other',
      labelKey: 'RATING.EPUB_MERGER_AND_SPLITTER_FEEDBACK.OPTIONS.OTHER',
      fallbackLabel: 'Another problem',
    },
  ];

export const EPUB_MERGER_AND_SPLITTER_RATING_TRANSLATION_OVERRIDES: RatingTranslationOverrides =
  {
    'es-MX': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'No encontró el problema',
            NOT_REPAIRED: 'No encontré el EPUB',
            STILL_BROKEN: 'Falló la unión o división',
            APP_CLOSED: 'La app se cerró',
            OTHER: 'Otro problema',
          },
        },
      },
    },
    'en-US': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'No issue found',
            NOT_REPAIRED: 'I could not find the EPUB',
            STILL_BROKEN: 'Merge or split failed',
            APP_CLOSED: 'App crashed',
            OTHER: 'Another problem',
          },
        },
      },
    },
    'de-DE': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Kein Problem gefunden',
            NOT_REPAIRED: 'Ich konnte das EPUB nicht finden',
            STILL_BROKEN: 'Zusammenführen oder Aufteilen ist fehlgeschlagen',
            APP_CLOSED: 'Die App ist abgestürzt',
            OTHER: 'Ein anderes Problem',
          },
        },
      },
    },
    'fr-FR': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Aucun problème trouvé',
            NOT_REPAIRED: "Je n'ai pas trouvé l'EPUB",
            STILL_BROKEN: 'La fusion ou la division a échoué',
            APP_CLOSED: "L'application s'est fermée",
            OTHER: 'Un autre problème',
          },
        },
      },
    },
    'it-IT': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Nessun problema trovato',
            NOT_REPAIRED: "Non ho trovato l'EPUB",
            STILL_BROKEN: 'Unione o divisione non riuscita',
            APP_CLOSED: "L'app si è chiusa",
            OTHER: 'Un altro problema',
          },
        },
      },
    },
    'pt-BR': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Nenhum problema encontrado',
            NOT_REPAIRED: 'Não encontrei o EPUB',
            STILL_BROKEN: 'A união ou divisão falhou',
            APP_CLOSED: 'O app fechou',
            OTHER: 'Outro problema',
          },
        },
      },
    },
    'zh-TW': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '沒有找到問題',
            NOT_REPAIRED: '我找不到 EPUB',
            STILL_BROKEN: '合併或分割失敗',
            APP_CLOSED: 'App 已關閉',
            OTHER: '其他問題',
          },
        },
      },
    },
    'hi-IN': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'कोई समस्या नहीं मिली',
            NOT_REPAIRED: 'मुझे EPUB नहीं मिला',
            STILL_BROKEN: 'जोड़ना या विभाजन विफल रहा',
            APP_CLOSED: 'ऐप बंद हो गई',
            OTHER: 'कोई और समस्या',
          },
        },
      },
    },
    'ja-JP': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '問題が見つかりませんでした',
            NOT_REPAIRED: 'EPUB が見つかりませんでした',
            STILL_BROKEN: '結合または分割に失敗しました',
            APP_CLOSED: 'アプリが終了しました',
            OTHER: 'その他の問題',
          },
        },
      },
    },
    'ko-KR': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '문제를 찾지 못함',
            NOT_REPAIRED: 'EPUB를 찾을 수 없었음',
            STILL_BROKEN: '병합 또는 분할에 실패함',
            APP_CLOSED: '앱이 종료됨',
            OTHER: '기타 문제',
          },
        },
      },
    },
    'zh-CN': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '没有找到问题',
            NOT_REPAIRED: '我找不到 EPUB',
            STILL_BROKEN: '合并或拆分失败',
            APP_CLOSED: 'App 已关闭',
            OTHER: '其他问题',
          },
        },
      },
    },
    'ru-RU': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Проблема не найдена',
            NOT_REPAIRED: 'Не удалось найти EPUB',
            STILL_BROKEN: 'Слияние или разделение не удалось',
            APP_CLOSED: 'Приложение закрылось',
            OTHER: 'Другая проблема',
          },
        },
      },
    },
    'ar-SA': {
      RATING: {
        EPUB_MERGER_AND_SPLITTER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'لم يتم العثور على مشكلة',
            NOT_REPAIRED: 'لم أتمكن من العثور على EPUB',
            STILL_BROKEN: 'فشل الدمج أو التقسيم',
            APP_CLOSED: 'أُغلق التطبيق',
            OTHER: 'مشكلة أخرى',
          },
        },
      },
    },
  };
