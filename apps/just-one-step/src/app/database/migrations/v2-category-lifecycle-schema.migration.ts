import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';

export const v2CategoryLifecycleSchemaMigration: SqliteMigration = {
  version: 2,
  name: 'category-lifecycle-schema',
  up: async (db) => {
    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN color TEXT NOT NULL DEFAULT '#6366F1';
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN icon TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN description TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1));
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN origin TEXT NOT NULL DEFAULT 'user' CHECK(origin IN ('seeded', 'user'));
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN seed_key TEXT NULL;
    `);

    await db.execute(`
      ALTER TABLE categories
      ADD COLUMN deleted_at TEXT NULL;
    `);

    await db.execute(`
      DROP INDEX IF EXISTS idx_categories_name_ci;
    `);

    await db.execute(`
      UPDATE categories
      SET sort_order = (
        SELECT COUNT(*)
        FROM categories c2
        WHERE c2.created_at < categories.created_at
          OR (c2.created_at = categories.created_at AND c2.id <= categories.id)
      ) - 1;
    `);

    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_seed_key
      ON categories(seed_key)
      WHERE seed_key IS NOT NULL AND deleted_at IS NULL;
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS ix_categories_active_sort
      ON categories(deleted_at, is_archived, sort_order, created_at);
    `);
  },
};
