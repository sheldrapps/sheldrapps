import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';
import { v1InitialSchemaMigration } from './v1-initial-schema.migration';
import { v2CategoryLifecycleSchemaMigration } from './v2-category-lifecycle-schema.migration';
import { v3TaskLifecycleSchemaMigration } from './v3-task-lifecycle-schema.migration';

export const nextStepMigrations: SqliteMigration[] = [
  v1InitialSchemaMigration,
  v2CategoryLifecycleSchemaMigration,
  v3TaskLifecycleSchemaMigration,
];
