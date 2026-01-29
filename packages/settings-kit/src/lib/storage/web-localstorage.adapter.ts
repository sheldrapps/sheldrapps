/**
 * Web localStorage adapter (fallback)
 * Wraps synchronous localStorage in async interface
 */

import { StorageAdapter } from './storage.adapter';

export class WebLocalStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<string | null> {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }
      return localStorage.getItem(key);
    } catch (error) {
      console.warn('[settings-kit] localStorage.getItem failed:', error);
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('[settings-kit] localStorage.setItem failed:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('[settings-kit] localStorage.removeItem failed:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      if (typeof localStorage === 'undefined') {
        return false;
      }
      return localStorage.getItem(key) !== null;
    } catch (error) {
      console.warn('[settings-kit] localStorage.has failed:', error);
      return false;
    }
  }
}
