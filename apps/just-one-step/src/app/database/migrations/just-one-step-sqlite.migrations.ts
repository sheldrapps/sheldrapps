import { SqliteMigration } from '@sheldrapps/native-sqlite-kit';
import { v1InitialSchemaMigration } from './v1-initial-schema.migration';
import { v2CategoryLifecycleSchemaMigration } from './v2-category-lifecycle-schema.migration';
import { v3TaskLifecycleSchemaMigration } from './v3-task-lifecycle-schema.migration';
import { v4TaskSchedulingV2SchemaMigration } from './v4-task-scheduling-v2-schema.migration';
import { v5TaskPrioritySchemaMigration } from './v5-task-priority-schema.migration';
import { v6TaskLocalCalendarSchemaMigration } from './v6-task-local-calendar-schema.migration';

export const justOneStepMigrations: SqliteMigration[] = [
  v1InitialSchemaMigration,
  v2CategoryLifecycleSchemaMigration,
  v3TaskLifecycleSchemaMigration,
  v4TaskSchedulingV2SchemaMigration,
  v5TaskPrioritySchemaMigration,
  v6TaskLocalCalendarSchemaMigration,
];
