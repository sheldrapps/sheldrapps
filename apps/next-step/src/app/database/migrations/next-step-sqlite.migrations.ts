import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';
import { v1InitialSchemaMigration } from './v1-initial-schema.migration';

export const nextStepMigrations: SqliteMigration[] = [
  v1InitialSchemaMigration,
];
