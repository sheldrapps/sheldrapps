import { Provider } from '@angular/core';

import { CapacitorFilesystemAdapter } from './adapters/capacitor/capacitor-filesystem.adapter';
import { CapacitorShareAdapter } from './adapters/capacitor/capacitor-share.adapter';
import { FileKitService } from './file-kit.service';
import {
  FILESYSTEM_ADAPTER_TOKEN,
  FILE_KIT_CONFIG_TOKEN,
  type FileKitConfig,
  SHARE_ADAPTER_TOKEN,
} from './provider-tokens';
import {
  WebPdfCoverService,
  WEB_PDF_COVER_SERVICE_TOKEN,
} from './web-pdf-cover.service';

export function providePdfFileKit(config?: FileKitConfig): Provider[] {
  const mergedConfig: FileKitConfig = {
    ...config,
    enableWebDevAdapters: false,
  };

  return [
    {
      provide: FILE_KIT_CONFIG_TOKEN,
      useValue: mergedConfig,
    },
    {
      provide: FILESYSTEM_ADAPTER_TOKEN,
      useValue:
        mergedConfig.filesystemAdapter || new CapacitorFilesystemAdapter(),
    },
    {
      provide: SHARE_ADAPTER_TOKEN,
      useValue: mergedConfig.shareAdapter || new CapacitorShareAdapter(),
    },
    {
      provide: WEB_PDF_COVER_SERVICE_TOKEN,
      useClass: WebPdfCoverService,
    },
    FileKitService,
  ];
}