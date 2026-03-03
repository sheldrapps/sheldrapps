/**
 * Composite storage adapter.
 * Reads from multiple adapters in order and removes from all of them.
 */

import { StorageAdapter } from './storage.adapter';

export class CompositeStorageAdapter implements StorageAdapter {
  constructor(private readonly adapters: readonly StorageAdapter[]) {}

  async get(key: string): Promise<string | null> {
    for (const adapter of this.adapters) {
      const value = await adapter.get(key);
      if (value !== null) {
        return value;
      }
    }

    return null;
  }

  async set(key: string, value: string): Promise<void> {
    const [first] = this.adapters;
    if (!first) return;
    await first.set(key, value);
  }

  async remove(key: string): Promise<void> {
    await Promise.all(
      this.adapters.map(async (adapter) => {
        try {
          await adapter.remove(key);
        } catch {
          // Best effort cleanup for legacy stores.
        }
      })
    );
  }

  async has(key: string): Promise<boolean> {
    for (const adapter of this.adapters) {
      if (await adapter.has(key)) {
        return true;
      }
    }

    return false;
  }
}
