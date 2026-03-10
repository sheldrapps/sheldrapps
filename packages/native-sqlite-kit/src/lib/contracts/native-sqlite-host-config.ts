import { SqliteMigration } from './sqlite-migration';
import { SqliteSeeder } from './sqlite-seeder';

export interface NativeSqliteHostConfig {
  databaseName: string;
  migrations: readonly SqliteMigration[];
  seeders?: readonly SqliteSeeder[];
  debug?: boolean;
}
