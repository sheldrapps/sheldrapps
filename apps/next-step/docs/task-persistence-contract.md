# Task Persistence Contract (Clean Core)

## Scope
This document defines the persistent Task aggregate contract used by Next Step after the clean schema reset.

## Tables

### `tasks` (root)
- `id` (PK)
- `title` (required)
- `description` (nullable)
- `category_id` (nullable FK -> `categories.id`)
- `tracking_mode` (`check | duration`)
- `estimated_duration_min` (nullable)
- `is_recurrence_enabled` (`0|1`)
- `is_notifications_enabled` (`0|1`)
- `created_at`
- `updated_at`

Rules:
- `estimated_duration_min` is `null` when `tracking_mode = 'check'`.
- `is_recurrence_enabled` mirrors persisted recurrence branch presence.
- `is_notifications_enabled` mirrors persisted notification branch presence.

### `categories`
- `id` (PK)
- `name`
- `created_at`
- `updated_at`

### `task_recurrence` (0..1 per task)
- `task_id` (PK + FK -> `tasks.id`, `ON DELETE CASCADE`)
- `pattern` (`daily | selected_weekdays | monthly | yearly`)
- `has_time` (`0|1`)
- `same_time_for_selected_days` (`0|1`)
- `common_time` (`HH:mm` or `null`)
- `starts_today` (`0|1`)
- `start_date`
- `has_end_date` (`0|1`)
- `end_date` (`null` when `has_end_date = 0`)
- `day_of_month` (monthly only)
- `year_month`, `year_day` (yearly only)
- `timezone` (nullable)
- `created_at`
- `updated_at`

### `task_recurrence_weekdays` (0..N per task)
- `id` (PK)
- `task_id` (FK -> `tasks.id`, `ON DELETE CASCADE`)
- `weekday_index` (`1..7`)
- `time_value` (`HH:mm` or `null`)
- `created_at`
- `updated_at`
- Unique: `(task_id, weekday_index)`

### `task_notifications` (0..1 per task)
- `task_id` (PK + FK -> `tasks.id`, `ON DELETE CASCADE`)
- `notification_type` (`tts | sound | vibration | popup | fullscreen`)
- `trigger_mode` (`at_time | before | manual_only`)
- `sound_name` (nullable)
- `tts_text` (nullable)
- `repeat_if_missed` (`0|1`)
- `created_at`
- `updated_at`

### `task_notification_offsets` (0..N per task)
- `id` (PK)
- `task_id` (FK -> `tasks.id`, `ON DELETE CASCADE`)
- `offset_minutes` (`> 0`)
- `sort_order`
- `created_at`
- `updated_at`
- Unique: `(task_id, offset_minutes)`

## Aggregate Persistence Rules

### Recurrence disabled
- Do not persist `task_recurrence`.
- Do not persist `task_recurrence_weekdays`.

### Notifications disabled
- Do not persist `task_notifications`.
- Do not persist `task_notification_offsets`.

### Trigger mode not `before`
- Persist notification row.
- Do not persist offsets.

### Pattern not `selected_weekdays`
- Do not persist weekday rows.

### `same_time_for_selected_days = 1`
- Use only `common_time`.
- Weekday `time_value` must be `null`.

### `has_time = 0`
- `common_time = null`.
- Weekday `time_value = null`.

### `has_end_date = 0`
- `end_date = null`.

## CRUD Semantics

### `createTask(input)`
- Single transaction.
- Inserts `tasks` root and compatible child branches.
- Sanitizes incompatible child payload before write.

### `getTaskById(taskId)`
- Canonical reconstruction of aggregate from root + children.
- Deduplicates weekdays and offsets.
- Coerces inconsistent persisted notification state:
  - `trigger_mode = before` with zero offsets -> returned as `at_time`.

### `listTasks(filters)`
- Returns summary list rows (`TaskListItem`), not full aggregate.
- Aggregate details are loaded on demand via `getTaskById`.

### `updateTask(taskId, input)`
- Single transaction.
- Updates root row.
- Clears all child branches for the task.
- Re-persists only compatible branches from sanitized input.

### `deleteTask(taskId)`
- Deletes only root row.
- Child rows are removed by FK `ON DELETE CASCADE`.

## Domain vs UI Draft

Persisted:
- `tasks` + `task_recurrence` + `task_recurrence_weekdays` + `task_notifications` + `task_notification_offsets`.

UI draft only (must never be persisted):
- Expansion/collapse state.
- Touched/dirty flags.
- Modal open state.
- Temporary chip selections before confirmation.
- Form-only validation errors.
