import { inject } from '@angular/core';
import type { Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import {
  EPUB_FIXER_PORT as EPUB_MERGER_AND_SPLITTER_PORT,
  NativeEpubFixerAdapter as NativeEpubMergerAndSplitterAdapter,
  WebDevEpubFixerAdapter as WebDevEpubMergerAndSplitterAdapter,
} from '@sheldrapps/file-kit';

export function provideWebDevEpubMergerAndSplitterPort(): Provider[] {
  return [
    NativeEpubMergerAndSplitterAdapter,
    WebDevEpubMergerAndSplitterAdapter,
    {
      provide: EPUB_MERGER_AND_SPLITTER_PORT,
      useFactory: () =>
        Capacitor.isNativePlatform()
          ? inject(NativeEpubMergerAndSplitterAdapter)
          : inject(WebDevEpubMergerAndSplitterAdapter),
    },
  ];
}
