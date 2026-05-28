import { Provider } from "@angular/core";
import { CapacitorFilesystemAdapter } from "./adapters/capacitor/capacitor-filesystem.adapter";
import { CapacitorShareAdapter } from "./adapters/capacitor/capacitor-share.adapter";
import { FileKitService } from "./file-kit.service";
import {
  FILESYSTEM_ADAPTER_TOKEN,
  SHARE_ADAPTER_TOKEN,
  FILE_KIT_CONFIG_TOKEN,
  FileKitConfig,
} from "./provider-tokens";
import {
  WebEpubCoverService,
  WEB_EPUB_COVER_SERVICE_TOKEN,
} from "./web-epub-cover.service";

/**
 * Injection token for filesystem adapter
 */
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
