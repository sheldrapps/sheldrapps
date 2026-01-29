/**
 * Angular providers for file-kit
 */

import { InjectionToken, Provider } from '@angular/core';
import { FilesystemAdapter } from './adapters/filesystem.adapter';
import { ShareAdapter } from './adapters/share.adapter';
import { CapacitorFilesystemAdapter } from './adapters/capacitor/capacitor-filesystem.adapter';
import { CapacitorShareAdapter } from './adapters/capacitor/capacitor-share.adapter';
import { FileKitService } from './file-kit.service';

/**
 * Injection token for filesystem adapter
 */
export const FILESYSTEM_ADAPTER_TOKEN = new InjectionToken<FilesystemAdapter>(
  'FILESYSTEM_ADAPTER'
);

/**
 * Injection token for share adapter
 */
export const SHARE_ADAPTER_TOKEN = new InjectionToken<ShareAdapter>(
  'SHARE_ADAPTER'
);

/**
 * Configuration for file-kit
 */
export interface FileKitConfig {
  /**
   * Custom filesystem adapter
   */
  filesystemAdapter?: FilesystemAdapter;

  /**
   * Custom share adapter
   */
  shareAdapter?: ShareAdapter;
}

/**
 * Provide file-kit for an Angular application
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideFileKit()
 *   ]
 * });
 * ```
 */
export function provideFileKit(config?: FileKitConfig): Provider[] {
  console.log('[file-kit] Providing file-kit');

  return [
    // Filesystem adapter
    {
      provide: FILESYSTEM_ADAPTER_TOKEN,
      useValue:
        config?.filesystemAdapter || new CapacitorFilesystemAdapter(),
    },

    // Share adapter
    {
      provide: SHARE_ADAPTER_TOKEN,
      useValue: config?.shareAdapter || new CapacitorShareAdapter(),
    },

    // Service
    FileKitService,
  ];
}
