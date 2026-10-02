import { Provider } from '@angular/core';
import { CapacitorFilesystemAdapter } from './adapters/capacitor/capacitor-filesystem.adapter';
import { CapacitorShareAdapter } from './adapters/capacitor/capacitor-share.adapter';
import { FileKitService } from './file-kit.service';
import {
  FILESYSTEM_ADAPTER_TOKEN,
  SHARE_ADAPTER_TOKEN,
  FILE_KIT_CONFIG_TOKEN,
  FileKitConfig,
} from './provider-tokens';

export function provideNativeFileKit(
  config?: Omit<FileKitConfig, 'enableWebDevAdapters'>,
): Provider[] {
  return [
    {
      provide: FILE_KIT_CONFIG_TOKEN,
      useValue: { ...config, enableWebDevAdapters: false },
    },
    {
      provide: FILESYSTEM_ADAPTER_TOKEN,
      useValue: config?.filesystemAdapter || new CapacitorFilesystemAdapter(),
    },
    {
      provide: SHARE_ADAPTER_TOKEN,
      useValue: config?.shareAdapter || new CapacitorShareAdapter(),
    },
    FileKitService,
  ];
}
