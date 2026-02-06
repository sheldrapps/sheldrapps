/**
 * Capacitor Preferences adapter
 * Uses @capacitor/preferences when available, falls back to localStorage
 */

import { StorageAdapter } from './storage.adapter';
import { WebLocalStorageAdapter } from './web-localstorage.adapter';

export class CapacitorPreferencesAdapter implements StorageAdapter {
  private fallback = new WebLocalStorageAdapter();
  private preferences: any = null;
  private isCapacitorAvailable = false;

  constructor() {
    this.initCapacitor();
  }

  private async initCapacitor(): Promise<void> {
    try {
      // Dynamic import to avoid breaking web builds without Capacitor
      const { Preferences } = await import('@capacitor/preferences');
      this.preferences = Preferences;
      this.isCapacitorAvailable = true;
    } catch (error) {
      this.isCapacitorAvailable = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isCapacitorAvailable && this.preferences) {
      try {
        const result = await this.preferences.get({ key });
        return result.value ?? null;
      } catch (error) {
        console.warn('[settings-kit] Capacitor Preferences.get failed:', error);
        return this.fallback.get(key);
      }
    }
    return this.fallback.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    if (this.isCapacitorAvailable && this.preferences) {
      try {
        await this.preferences.set({ key, value });
        return;
      } catch (error) {
        console.warn('[settings-kit] Capacitor Preferences.set failed:', error);
        return this.fallback.set(key, value);
      }
    }
    return this.fallback.set(key, value);
  }

  async remove(key: string): Promise<void> {
    if (this.isCapacitorAvailable && this.preferences) {
      try {
        await this.preferences.remove({ key });
        return;
      } catch (error) {
        console.warn('[settings-kit] Capacitor Preferences.remove failed:', error);
        return this.fallback.remove(key);
      }
    }
    return this.fallback.remove(key);
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }
}
