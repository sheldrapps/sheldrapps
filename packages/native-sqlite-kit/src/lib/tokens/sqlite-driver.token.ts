import { InjectionToken } from '@angular/core';
import { SqliteDriver } from '../driver';

export const SQLITE_DRIVER_TOKEN = new InjectionToken<SqliteDriver>(
  'SQLITE_DRIVER'
);
