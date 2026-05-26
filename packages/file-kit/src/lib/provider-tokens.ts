import { InjectionToken } from '@angular/core';

import { FilesystemAdapter } from './adapters/filesystem.adapter';
import { ShareAdapter } from './adapters/share.adapter';

export interface FileKitConfig {
  filesystemAdapter?: FilesystemAdapter;
  shareAdapter?: ShareAdapter;
  enableWebDevAdapters?: boolean;
}

export const FILESYSTEM_ADAPTER_TOKEN = new InjectionToken<FilesystemAdapter>(
  'FILESYSTEM_ADAPTER',
);

export const SHARE_ADAPTER_TOKEN = new InjectionToken<ShareAdapter>(
  'SHARE_ADAPTER',
);

export const FILE_KIT_CONFIG_TOKEN = new InjectionToken<FileKitConfig>(
  'FILE_KIT_CONFIG',
);