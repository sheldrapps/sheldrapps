import { Injectable, InjectionToken, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { FileKitService } from '@sheldrapps/file-kit';

export type RecoveryAssetMeta = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
  lastModified: number;
};

export type RecoveryStoreConfig = {
  appId: string;
  schemaVersion: number;
  folder?: string;
};

export type RecoveryStoreStorage = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

export const RECOVERY_STORE_CONFIG = new InjectionToken<RecoveryStoreConfig>(
  'RECOVERY_STORE_CONFIG',
  { providedIn: 'root', factory: () => ({ appId: 'app', schemaVersion: 1 }) },
);

export const RECOVERY_STORE_STORAGE = new InjectionToken<RecoveryStoreStorage>(
  'RECOVERY_STORE_STORAGE',
  { providedIn: 'root', factory: () => Preferences },
);

export type RecoveryLoadResult<T extends object> = {
  payload: T;
  assets: Record<string, File | undefined>;
};

@Injectable({ providedIn: 'root' })
export class PersistentRecoveryStore<T extends object = Record<string, unknown>> {
  private readonly fileKit = inject(FileKitService);
  private readonly storage = inject(RECOVERY_STORE_STORAGE);
  private readonly config = inject(RECOVERY_STORE_CONFIG);
  private writeQueue = Promise.resolve();

  async save(payload: T, assets: Record<string, File | undefined> = {}): Promise<void> {
    const saveOperation = async () => {
      const persistedAssets: Record<string, RecoveryAssetMeta | undefined> = {};
      for (const [role, file] of Object.entries(assets)) {
        persistedAssets[role] = await this.persistAsset(role, file);
      }
      const next = {
        ...payload,
        schemaVersion: this.config.schemaVersion,
        savedAt: new Date().toISOString(),
        recoveryAssets: persistedAssets,
      };
      await this.storage.set({
        key: this.storageKey,
        value: JSON.stringify(next),
      });
    };
    this.writeQueue = this.writeQueue.then(saveOperation, saveOperation);
    await this.writeQueue;
  }

  async load(): Promise<RecoveryLoadResult<T> | null> {
    const stored = await this.storage.get({ key: this.storageKey });
    if (!stored.value) return null;
    try {
      const raw = JSON.parse(stored.value) as T & {
        schemaVersion?: number;
        savedAt?: string;
        recoveryAssets?: Record<string, RecoveryAssetMeta | undefined>;
      };
      if (raw.schemaVersion !== this.config.schemaVersion) return null;
      const assets: Record<string, File | undefined> = {};
      for (const [role, meta] of Object.entries(raw.recoveryAssets ?? {})) {
        assets[role] = await this.readAsset(meta);
      }
      const { schemaVersion: _schemaVersion, savedAt: _savedAt, recoveryAssets: _assets, ...payload } = raw;
      return { payload: payload as T, assets };
    } catch {
      return null;
    }
  }

  async clear(fallbackRoles: string[] = []): Promise<void> {
    const clearOperation = async () => {
      const stored = await this.storage.get({ key: this.storageKey });
      const roles = stored.value ? this.readRoles(stored.value) : fallbackRoles;
      await this.storage.remove({ key: this.storageKey });
      await Promise.all(roles.map((role) => this.deleteAsset(role)));
    };
    this.writeQueue = this.writeQueue.then(clearOperation, clearOperation);
    await this.writeQueue;
  }

  private get storageKey(): string {
    return `${this.config.appId}.workflow-recovery.v${this.config.schemaVersion}`;
  }

  private get folder(): string {
    return this.config.folder ?? `${this.config.appId}Recovery`;
  }

  private async persistAsset(
    role: string,
    file: File | undefined,
  ): Promise<RecoveryAssetMeta | undefined> {
    if (!file) {
      await this.deleteAsset(role);
      return undefined;
    }
    const path = `${this.folder}/${this.safeRole(role)}.${this.extensionFor(file)}`;
    await this.deleteAsset(role);
    await this.fileKit.writeBytes({
      dir: 'Data',
      path,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type || 'application/octet-stream',
    });
    return {
      path,
      name: file.name || `${role}.bin`,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified || Date.now(),
    };
  }

  private async readAsset(meta?: RecoveryAssetMeta): Promise<File | undefined> {
    if (!meta) return undefined;
    try {
      const bytes = await this.fileKit.readBytes({ dir: 'Data', path: meta.path });
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      return new File([buffer], meta.name, {
        type: meta.mimeType,
        lastModified: meta.lastModified,
      });
    } catch {
      return undefined;
    }
  }

  private async deleteAsset(role: string): Promise<void> {
    for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'bin', 'pdf']) {
      await this.fileKit
        .delete({
          dir: 'Data',
          path: `${this.folder}/${this.safeRole(role)}.${extension}`,
        })
        .catch(() => undefined);
    }
  }

  private readRoles(value: string): string[] {
    try {
      const parsed = JSON.parse(value) as {
        recoveryAssets?: Record<string, RecoveryAssetMeta | undefined>;
      };
      return Object.keys(parsed.recoveryAssets ?? {});
    } catch {
      return [];
    }
  }

  private safeRole(role: string): string {
    return role.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private extensionFor(file: File): string {
    const type = file.type.toLowerCase();
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
    if (type === 'application/pdf') return 'pdf';
    const name = file.name.toLowerCase();
    if (name.endsWith('.png')) return 'png';
    if (name.endsWith('.webp')) return 'webp';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
    if (name.endsWith('.pdf')) return 'pdf';
    return 'bin';
  }
}

export function provideRecoveryStore(config: RecoveryStoreConfig): {
  provide: InjectionToken<RecoveryStoreConfig>;
  useValue: RecoveryStoreConfig;
}[] {
  return [{ provide: RECOVERY_STORE_CONFIG, useValue: config }];
}
