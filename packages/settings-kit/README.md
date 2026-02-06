# @sheldrapps/settings-kit

Reusable settings persistence kit for Angular apps with async storage and migrations.

## Features

- Async storage using Capacitor Preferences (with localStorage fallback)
- Type-safe settings schema with versioning
- Migration system for legacy data and schema upgrades
- Single JSON key per app for clean storage
- No dependencies on UI, routing, or other kits
- Observable changes stream

## Installation

```bash
pnpm add @sheldrapps/settings-kit
```

## Usage

### 1. Define your settings schema

```typescript
import { SettingsSchema } from '@sheldrapps/settings-kit';

interface MyAppSettings {
  lang: string;
  theme: 'light' | 'dark';
}

export const MY_APP_SETTINGS_SCHEMA: SettingsSchema<MyAppSettings> = {
  version: 1,
  defaults: {
    lang: 'en-US',
    theme: 'light'
  },
  migrations: [
    {
      fromVersion: 'legacy',
      toVersion: 1,
      run: async (ctx) => {
        // Migrate from old localStorage keys
        const lang = await ctx.legacy?.get('lang');
        if (lang) {
          await ctx.legacy?.remove('lang');
          return { lang };
        }
        return {};
      }
    }
  ]
};
```

### 2. Provide the kit

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideSettingsKit } from '@sheldrapps/settings-kit';
import { MY_APP_SETTINGS_SCHEMA } from './settings.schema';

bootstrapApplication(AppComponent, {
  providers: [
    provideSettingsKit({
      appId: 'myapp',
      schema: MY_APP_SETTINGS_SCHEMA
    })
  ]
});
```

### 3. Use in your components

```typescript
import { Component, inject } from '@angular/core';
import { SettingsStore } from '@sheldrapps/settings-kit';
import { MyAppSettings } from './settings.schema';

@Component({...})
export class AppComponent {
  private settings = inject(SettingsStore<MyAppSettings>);

  async ngOnInit() {
    // Load settings (runs migrations if needed)
    await this.settings.load();
    
    // Get current snapshot
    const current = this.settings.get();
    // handle current lang here
    
    // Update settings
    await this.settings.set({ lang: 'es-MX' });
    
    // Or with function
    await this.settings.set(prev => ({ ...prev, theme: 'dark' }));
    
    // Subscribe to changes
    this.settings.changes$.subscribe(settings => {
      // handle settings change here
    });
  }
}
```

## API

### `SettingsStore<T>`

- `load(): Promise<T>` - Load settings (idempotent, runs migrations once)
- `get(): T` - Get current settings snapshot
- `set(update: Partial<T> | (prev: T) => T): Promise<T>` - Update settings
- `reset(): Promise<T>` - Reset to defaults
- `changes$: Observable<T>` - Observable of settings changes

### `provideSettingsKit<T>(config)`

Configure the settings kit with your app ID and schema.

### Storage

The kit uses Capacitor Preferences when available, falling back to localStorage for web.
All settings are stored in a single JSON key: `<appId>.settings`.

### Migrations

Migrations run once, before the first snapshot is exposed. They are idempotent and can:
- Read from legacy localStorage keys
- Transform old data formats
- Remove legacy keys after successful migration

## License

MIT
