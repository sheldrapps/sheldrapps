import { inject } from '@angular/core';
import type { Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import {
  EPUB_FIXER_PORT,
  NativeEpubFixerAdapter,
} from '@sheldrapps/file-kit';
import { EpubFixerWebMockAdapter } from '../services/epub-fixer-web-mock.adapter';

export function provideWebDevEpubFixerPort(): Provider[] {
  return [
    NativeEpubFixerAdapter,
    EpubFixerWebMockAdapter,
    {
      provide: EPUB_FIXER_PORT,
      useFactory: () =>
        Capacitor.isNativePlatform()
          ? inject(NativeEpubFixerAdapter)
          : inject(EpubFixerWebMockAdapter),
    },
  ];
}
