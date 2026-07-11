import type {
  RatingFeedbackOption,
  RatingTranslationOverrides,
} from '@sheldrapps/rating-kit';

export const EPUB_FIXER_RATING_FEEDBACK_OPTIONS: readonly RatingFeedbackOption[] =
  [
    {
      id: 'file_not_saved',
      labelKey: 'RATING.EPUB_FIXER_FEEDBACK.OPTIONS.NO_ISSUE_FOUND',
      fallbackLabel: 'No issue found',
    },
    {
      id: 'file_not_found',
      labelKey: 'RATING.EPUB_FIXER_FEEDBACK.OPTIONS.NOT_REPAIRED',
      fallbackLabel: 'Not repaired',
    },
    {
      id: 'image_blurry',
      labelKey: 'RATING.EPUB_FIXER_FEEDBACK.OPTIONS.STILL_BROKEN',
      fallbackLabel: 'Still broken',
    },
    {
      id: 'app_crashed',
      labelKey: 'RATING.EPUB_FIXER_FEEDBACK.OPTIONS.APP_CLOSED',
      fallbackLabel: 'App crashed',
    },
    {
      id: 'other',
      labelKey: 'RATING.EPUB_FIXER_FEEDBACK.OPTIONS.OTHER',
      fallbackLabel: 'Another problem',
    },
  ];

export const EPUB_FIXER_RATING_TRANSLATION_OVERRIDES: RatingTranslationOverrides =
  {
    'es-MX': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'No encontró el problema',
            NOT_REPAIRED: 'No se reparó',
            STILL_BROKEN: 'El EPUB sigue roto',
            APP_CLOSED: 'La app se cerró',
            OTHER: 'Otro problema',
          },
        },
      },
    },
    'en-US': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'No issue found',
            NOT_REPAIRED: 'Not repaired',
            STILL_BROKEN: 'Still broken',
            APP_CLOSED: 'App crashed',
            OTHER: 'Another problem',
          },
        },
      },
    },
    'de-DE': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Kein Problem gefunden',
            NOT_REPAIRED: 'Nicht repariert',
            STILL_BROKEN: 'EPUB ist noch kaputt',
            APP_CLOSED: 'Die App ist abgestürzt',
            OTHER: 'Ein anderes Problem',
          },
        },
      },
    },
    'fr-FR': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Aucun problème trouvé',
            NOT_REPAIRED: 'Non réparé',
            STILL_BROKEN: "L'EPUB est toujours cassé",
            APP_CLOSED: "L'application s'est fermée",
            OTHER: 'Un autre problème',
          },
        },
      },
    },
    'it-IT': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Nessun problema trovato',
            NOT_REPAIRED: 'Non è stato riparato',
            STILL_BROKEN: "L'EPUB è ancora rotto",
            APP_CLOSED: "L'app si è chiusa",
            OTHER: 'Un altro problema',
          },
        },
      },
    },
    'pt-BR': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Nenhum problema encontrado',
            NOT_REPAIRED: 'Não foi reparado',
            STILL_BROKEN: 'O EPUB ainda está quebrado',
            APP_CLOSED: 'O app fechou',
            OTHER: 'Outro problema',
          },
        },
      },
    },
    'zh-TW': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '沒有找到問題',
            NOT_REPAIRED: '尚未修復',
            STILL_BROKEN: 'EPUB 仍然損壞',
            APP_CLOSED: 'App 已關閉',
            OTHER: '其他問題',
          },
        },
      },
    },
    'hi-IN': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'कोई समस्या नहीं मिली',
            NOT_REPAIRED: 'मरम्मत नहीं हुई',
            STILL_BROKEN: 'EPUB अभी भी टूटा हुआ है',
            APP_CLOSED: 'ऐप बंद हो गई',
            OTHER: 'कोई और समस्या',
          },
        },
      },
    },
    'ja-JP': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '問題が見つかりませんでした',
            NOT_REPAIRED: '修復されていない',
            STILL_BROKEN: 'EPUB がまだ壊れています',
            APP_CLOSED: 'アプリが終了しました',
            OTHER: 'その他の問題',
          },
        },
      },
    },
    'ko-KR': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '문제를 찾지 못함',
            NOT_REPAIRED: '복구되지 않음',
            STILL_BROKEN: 'EPUB가 아직 손상됨',
            APP_CLOSED: '앱이 종료됨',
            OTHER: '기타 문제',
          },
        },
      },
    },
    'zh-CN': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: '没有找到问题',
            NOT_REPAIRED: '尚未修复',
            STILL_BROKEN: 'EPUB 仍然损坏',
            APP_CLOSED: 'App 已关闭',
            OTHER: '其他问题',
          },
        },
      },
    },
    'ru-RU': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'Проблема не найдена',
            NOT_REPAIRED: 'Не было исправлено',
            STILL_BROKEN: 'EPUB всё ещё повреждён',
            APP_CLOSED: 'Приложение закрылось',
            OTHER: 'Другая проблема',
          },
        },
      },
    },
    'ar-SA': {
      RATING: {
        EPUB_FIXER_FEEDBACK: {
          OPTIONS: {
            NO_ISSUE_FOUND: 'لم يتم العثور على مشكلة',
            NOT_REPAIRED: 'لم يتم إصلاحه',
            STILL_BROKEN: 'ما زال EPUB تالفًا',
            APP_CLOSED: 'أُغلق التطبيق',
            OTHER: 'مشكلة أخرى',
          },
        },
      },
    },
  };
