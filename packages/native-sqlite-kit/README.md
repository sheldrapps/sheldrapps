# Native SQLite Kit

`@sheldrapps/native-sqlite-kit` is a host-driven infrastructure package for
native SQLite access in Ionic + Angular standalone + Capacitor Android apps.

## Scope

- Android native SQLite only
- No IndexedDB/localStorage/web fallback
- No app-specific schema or repositories

## What The Kit Provides

- Driver abstraction (`SqliteDriver`)
- Capacitor SQLite driver implementation
- Initialization lifecycle manager
- Migration runner with `__migrations` metadata table
- High-level transaction API with automatic rollback on failure
- Optional repository base primitives
- Angular provider wiring for standalone bootstraps

## What The Host App Provides

- Database name
- Migrations
- Optional seeders
- App repositories and domain logic

## Install In App

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideNativeSqlite } from '@sheldrapps/native-sqlite-kit';

bootstrapApplication(AppComponent, {
  providers: [
    provideNativeSqlite({
      databaseName: 'next-step.db',
      migrations: nextStepMigrations,
      seeders: [],
      debug: false
    })
  ]
});
```

## Example App Usage

```ts
await this.sqliteManager.runInTransaction(async (tx) => {
  await tx.execute(
    'INSERT INTO tasks (id, title, created_at) VALUES (?, ?, ?)',
    [id, title, createdAt]
  );

  await tx.execute(
    'INSERT INTO task_log (task_id, action) VALUES (?, ?)',
    [id, 'created']
  );
});
```

## Notes

- The provider initializes SQLite on app bootstrap by default.
- Set `initializeOnAppBootstrap: false` to initialize manually.
- Migrations are versioned and executed in ascending order.
- Applied migrations are tracked in `__migrations`.
