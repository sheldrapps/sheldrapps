import {
  ENVIRONMENT_INITIALIZER,
  inject,
  makeEnvironmentProviders,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { COVER_SOURCE_TRANSLATIONS } from "./cover-source.translations";

const COVER_SOURCE_DESCRIPTION_FALLBACKS: Record<string, Record<string, string>> = {
  "ar-SA": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "اختر صورة من معرضك للبدء.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "في محررنا، اختر نمطًا أو لونًا للخلفية للإنشاء.",
  },
  "de-DE": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "Wähle zum Start ein Bild aus deiner Galerie.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "Wähle in unserem Editor ein Hintergrundmuster oder eine Farbe.",
  },
  "fr-FR": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "Sélectionnez une image de votre galerie pour commencer.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "Dans notre éditeur, choisissez un motif ou une couleur de fond.",
  },
  "hi-IN": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "शुरू करने के लिए अपनी गैलरी से एक छवि चुनें।",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "हमारे संपादक में बनाने के लिए पृष्ठभूमि पैटर्न या रंग चुनें।",
  },
  "it-IT": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "Seleziona un’immagine dalla galleria per iniziare.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "Nel nostro editor, scegli un motivo o un colore di sfondo.",
  },
  "ja-JP": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "ギャラリーから画像を選んで始めます。",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "エディターで背景のパターンや色を選んで作成します。",
  },
  "ko-KR": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "갤러리에서 이미지를 선택하여 시작하세요.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "편집기에서 배경 패턴이나 색상을 선택하여 만드세요.",
  },
  "pt-BR": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "Selecione uma imagem da sua galeria para começar.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "No nosso editor, escolha um padrão ou uma cor de fundo.",
  },
  "ru-RU": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "Выберите изображение из галереи, чтобы начать.",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "В редакторе выберите фоновый узор или цвет.",
  },
  "zh-CN": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "从图库中选择图片即可开始。",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "在编辑器中选择背景图案或颜色来创建。",
  },
  "zh-TW": {
    "COVER_SOURCE.DESCRIPTIONS.IMAGE": "從圖庫選擇圖片即可開始。",
    "COVER_SOURCE.DESCRIPTIONS.SCRATCH": "在編輯器中選擇背景圖案或顏色來建立。",
  },
};

export function provideCoverSourceI18n() {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const translate = inject(TranslateService);
        const sampleKey = "COVER_SOURCE.ACTIONS.IMAGE";
        const merged = new Set<string>();

        const resolveDictForLang = (lang: string) => {
          if (!lang) return null;
          if (lang in COVER_SOURCE_TRANSLATIONS) {
            return COVER_SOURCE_TRANSLATIONS[
              lang as keyof typeof COVER_SOURCE_TRANSLATIONS
            ];
          }
          return null;
        };

        const mergeCoverSourceTranslations = (lang: string) => {
          const dict = resolveDictForLang(lang);
          const baseDict = COVER_SOURCE_TRANSLATIONS["en-US"];
          if (!baseDict && !dict) return;
          if (merged.has(lang)) return;
          merged.add(lang);

          if (baseDict) {
            translate.setTranslation(lang, baseDict, true);
          }
          if (dict) {
            translate.setTranslation(lang, dict, true);
          }
          const descriptionFallbacks = COVER_SOURCE_DESCRIPTION_FALLBACKS[lang];
          if (descriptionFallbacks) {
            translate.setTranslation(lang, descriptionFallbacks, true);
          }

          queueMicrotask(() => {
            merged.delete(lang);
          });
        };

        translate.onTranslationChange.subscribe((event) => {
          if (
            event.lang &&
            !Object.prototype.hasOwnProperty.call(
              event.translations,
              sampleKey,
            )
          ) {
            mergeCoverSourceTranslations(event.lang);
          }
        });

        translate.onLangChange.subscribe((event) => {
          mergeCoverSourceTranslations(event.lang);
          translate.instant(sampleKey);
        });
      },
    },
  ]);
}
