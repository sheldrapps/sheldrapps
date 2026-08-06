import { Injectable, inject } from '@angular/core';
import type { CoverCropState } from '@sheldrapps/image-workflow';
import {
  PersistentRecoveryStore,
  RECOVERY_STORE_STORAGE,
  type RecoveryAssetMeta,
} from '@sheldrapps/lifecycle-kit';

export const ECC_RECOVERY_STORAGE = RECOVERY_STORE_STORAGE;

export type EccRecoveryFileMeta = RecoveryAssetMeta;

export type EccRecoverySnapshot = {
  schemaVersion: 1;
  savedAt: string;
  workflowStep: number;
  lastEditorSourceMode: 'image' | 'scratch';
  selectedFormatId: string;
  exportQualityMode: string;
  targetWidth?: number;
  targetHeight?: number;
  originalImageDims?: { width: number; height: number };
  workingImageDims?: { width: number; height: number };
  selectedImageName?: string;
  cropState?: CoverCropState;
  sourceEpub?: {
    selectedName?: string;
    workingPath?: string;
    workingNativePath?: string;
    workingName?: string;
    outputBaseName?: string;
    coverEntryPath?: string;
    sourceUri?: string;
    sourceUriPermissionPersisted?: boolean;
    meta?: {
      name: string;
      size: number;
      lastModified: number;
      type: string;
    };
  };
  originalImage?: EccRecoveryFileMeta;
  workingImage?: EccRecoveryFileMeta;
  output?: {
    filename?: string;
    tempPath?: string;
    nativePath?: string;
    tempNativePath?: string;
    lastSavedFilename?: string;
    wasAutoSaved: boolean;
  };
  processing?: {
    kind: 'pick' | 'export' | 'rewrite' | null;
    active: boolean;
  };
};

export type EccRecoveryAssets = {
  originalImage?: File;
  workingImage?: File;
};

@Injectable({ providedIn: 'root' })
export class EccEditorRecoveryService {
  private readonly store = inject(
    PersistentRecoveryStore<EccRecoverySnapshot>,
  );

  async save(
    snapshot: Omit<EccRecoverySnapshot, 'schemaVersion' | 'savedAt'>,
    assets: EccRecoveryAssets,
  ): Promise<void> {
    await this.store.save(snapshot as EccRecoverySnapshot, {
      original: assets.originalImage,
      working: assets.workingImage,
    });
  }

  async load(): Promise<{
    snapshot: EccRecoverySnapshot;
    assets: EccRecoveryAssets;
  } | null> {
    const result = await this.store.load();
    if (!result) return null;
    const payload = result.payload as Omit<
      EccRecoverySnapshot,
      'schemaVersion' | 'savedAt'
    >;
    return {
      snapshot: {
        ...payload,
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        originalImage: undefined,
        workingImage: undefined,
      },
      assets: {
        originalImage: result.assets['original'],
        workingImage: result.assets['working'],
      },
    };
  }

  async clear(): Promise<void> {
    await this.store.clear(['original', 'working']);
  }
}
