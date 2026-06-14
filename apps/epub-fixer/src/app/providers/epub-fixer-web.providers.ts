import { inject } from '@angular/core';
import type { Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';

import {
  EPUB_FIXER_PORT,
  NativeEpubFixerAdapter,
} from '@sheldrapps/file-kit';
import { WebDevEpubFixerAdapter } from '../../../../../packages/file-kit/src/lib/adapters/web-dev-epub-fixer.adapter';

export function provideWebDevEpubFixerPort(): Provider[] {
  return [
    NativeEpubFixerAdapter,
    WebDevEpubFixerAdapter,
    {
      provide: EPUB_FIXER_PORT,
      useFactory: () =>
        Capacitor.isNativePlatform()
          ? inject(NativeEpubFixerAdapter)
          : inject(WebDevEpubFixerAdapter),
    },
  ];
}
