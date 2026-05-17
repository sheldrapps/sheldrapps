import { InjectionToken, Provider } from "@angular/core";
import { FilesystemAdapter } from "./adapters/filesystem.adapter";
import { ShareAdapter } from "./adapters/share.adapter";
import { CapacitorFilesystemAdapter } from "./adapters/capacitor/capacitor-filesystem.adapter";
import { CapacitorShareAdapter } from "./adapters/capacitor/capacitor-share.adapter";
import { FileKitService } from "./file-kit.service";
import {
  WebEpubCoverService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
} from "./web-epub-cover.service";

/**
 * Injection token for filesystem adapter
 */
export const FILESYSTEM_ADAPTER_TOKEN = new InjectionToken<FilesystemAdapter>(
  "FILESYSTEM_ADAPTER",
);

/**
 * Injection token for share adapter
 */
export const SHARE_ADAPTER_TOKEN = new InjectionToken<ShareAdapter>(
  "SHARE_ADAPTER",
);

/**
 * Injection token for file-kit configuration
 */
export const FILE_KIT_CONFIG_TOKEN = new InjectionToken<FileKitConfig>(
  "FILE_KIT_CONFIG",
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

  /**
   * Enable web development adapters (JSZip-based EPUB handling, WebDevEpubFixerAdapter).
   * Set to false in production to exclude web-dev code and reduce bundle size (~150KB).
   * @default true
   */
  enableWebDevAdapters?: boolean;
}

/**
 * Provide file-kit for an Angular application
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideFileKit({ enableWebDevAdapters: false })
 *   ]
 * });
 * ```
 */
export function provideFileKit(config?: FileKitConfig): Provider[] {
  const mergedConfig: FileKitConfig = {
    enableWebDevAdapters: true,
    ...config,
  };

  const providers: Provider[] = [
    // Configuration token (used by dependent services)
    {
      provide: FILE_KIT_CONFIG_TOKEN,
      useValue: mergedConfig,
    },

    // Filesystem adapter
    {
      provide: FILESYSTEM_ADAPTER_TOKEN,
      useValue:
        mergedConfig.filesystemAdapter || new CapacitorFilesystemAdapter(),
    },

    // Share adapter
    {
      provide: SHARE_ADAPTER_TOKEN,
      useValue: mergedConfig.shareAdapter || new CapacitorShareAdapter(),
    },

    // Service
    FileKitService,
  ];

  // Conditionally provide WebEpubCoverService
  // When disabled, tree-shaking will remove jszip from the bundle
  if (mergedConfig.enableWebDevAdapters !== false) {
    providers.push({
      provide: WEB_EPUB_COVER_SERVICE_TOKEN,
      useClass: WebEpubCoverService,
    });
  }

  return providers;
}
