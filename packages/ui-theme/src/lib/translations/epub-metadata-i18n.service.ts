import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { EPUB_METADATA_TRANSLATIONS } from './epub-metadata.translations';

@Injectable({ providedIn: 'root' })
export class EpubMetadataI18nService {
  private readonly translate = inject(TranslateService);
  private readonly registered = new Set<string>();

  constructor() {
    this.register(this.translate.currentLang || this.translate.defaultLang || 'en-US');
    this.translate.onLangChange.subscribe(({ lang }) => this.register(lang));
  }

  private register(lang: string): void {
    if (this.registered.has(lang)) {
      return;
    }

    const translations =
      EPUB_METADATA_TRANSLATIONS[lang] ?? EPUB_METADATA_TRANSLATIONS['en-US'];
    this.translate.setTranslation(lang, translations, true);
    this.registered.add(lang);
  }
}
