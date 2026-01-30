import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { AppSettings, ChildBudget } from './models';

export const PN_SETTINGS = 'PN_SETTINGS';
export const PN_CHILDREN = 'PN_CHILDREN';

@Injectable({
  providedIn: 'root',
})
export class StorageRepo {
  async loadSettings(): Promise<Partial<AppSettings> | null> {
    const result = await Preferences.get({ key: PN_SETTINGS });
    return this.parseJson<Partial<AppSettings>>(result.value);
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await Preferences.set({
      key: PN_SETTINGS,
      value: JSON.stringify(settings),
    });
  }

  async loadChildren(): Promise<ChildBudget[]> {
    const result = await Preferences.get({ key: PN_CHILDREN });
    return this.parseJson<ChildBudget[]>(result.value) ?? [];
  }

  async saveChildren(children: ChildBudget[]): Promise<void> {
    await Preferences.set({
      key: PN_CHILDREN,
      value: JSON.stringify(children),
    });
  }

  private parseJson<T>(value: string | null): T | null {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
}