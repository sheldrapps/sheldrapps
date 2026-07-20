import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
  E_READER_PREVIEW_FRAME_TRANSLATIONS,
  type EReaderPreviewFrameFlatDict,
} from './e-reader-preview-frame.translations';

const PREVIEW_PAGE_TRANSLATIONS: Record<string, EReaderPreviewFrameFlatDict> = {
  'en-US': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Preview', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'What color is your e-reader?' },
  'es-MX': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Previsualización', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': '¿De qué color es tu e-reader?' },
  'de-DE': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Vorschau', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'Welche Farbe hat dein E-Reader?' },
  'fr-FR': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Aperçu', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'De quelle couleur est votre liseuse ?' },
  'it-IT': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Anteprima', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'Di che colore è il tuo e-reader?' },
  'pt-BR': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Prévia', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'Qual é a cor do seu e-reader?' },
  'zh-TW': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': '預覽', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': '你的電子閱讀器是什麼顏色？' },
  'hi-IN': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'पूर्वावलोकन', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'आपका ई-रीडर किस रंग का है?' },
  'ar-SA': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'معاينة', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'ما لون القارئ الإلكتروني الخاص بك؟' },
  'ja-JP': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'プレビュー', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'あなたの電子書籍リーダーは何色ですか？' },
  'ko-KR': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': '미리보기', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': '전자책 리더는 무슨 색인가요?' },
  'zh-CN': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': '预览', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': '你的电子阅读器是什么颜色？' },
  'ru-RU': { 'IMAGE_WORKFLOW.PREVIEW_TITLE': 'Предпросмотр', 'E_READER_FRAME.COLOR_SELECTOR.QUESTION': 'Какого цвета ваша электронная книга?' },
};

@Injectable({ providedIn: 'root' })
export class ImageWorkflowI18nService {
  private readonly translate = inject(TranslateService);
  private readonly registered = new Set<string>();

  constructor() {
    this.register(this.translate.currentLang || this.translate.defaultLang);
    this.translate.onLangChange.subscribe(({ lang }) => this.register(lang));
    this.translate.onTranslationChange.subscribe(({ lang }) => this.register(lang));
  }

  private register(lang: string | null | undefined): void {
    if (!lang || this.registered.has(lang)) {
      return;
    }

    const base = E_READER_PREVIEW_FRAME_TRANSLATIONS['en-US'];
    const frame = E_READER_PREVIEW_FRAME_TRANSLATIONS[lang as keyof typeof E_READER_PREVIEW_FRAME_TRANSLATIONS];
    const page = PREVIEW_PAGE_TRANSLATIONS[lang];
    const fallbackPage = PREVIEW_PAGE_TRANSLATIONS['en-US'];

    this.translate.setTranslation(lang, base, true);
    if (frame) {
      this.translate.setTranslation(lang, frame, true);
    }
    this.translate.setTranslation(lang, fallbackPage, true);
    if (page) {
      this.translate.setTranslation(lang, page, true);
    }
    this.registered.add(lang);
  }
}
