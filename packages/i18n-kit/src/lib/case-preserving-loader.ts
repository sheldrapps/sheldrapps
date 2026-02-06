import { HttpClient } from '@angular/common/http';
import { TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

/**
 * Case-preserving TranslateLoader
 * Ensures the lang code is used exactly as provided (no lowercasing)
 */
export class CasePreservingTranslateLoader implements TranslateLoader {
  constructor(
    private http: HttpClient,
    private prefix: string,
    private suffix: string
  ) {}

  getTranslation(lang: string): Observable<any> {
    const url = `${this.prefix}${lang}${this.suffix}`;
    return this.http.get<any>(url);
  }
}

export function createCasePreservingTranslateLoader(
  http: HttpClient,
  prefix: string,
  suffix: string
): TranslateLoader {
  return new CasePreservingTranslateLoader(http, prefix, suffix);
}
