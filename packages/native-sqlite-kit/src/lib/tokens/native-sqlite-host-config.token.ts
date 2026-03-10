import { InjectionToken } from '@angular/core';
import { NativeSqliteHostConfig } from '../contracts';

export const NATIVE_SQLITE_HOST_CONFIG_TOKEN =
  new InjectionToken<NativeSqliteHostConfig>('NATIVE_SQLITE_HOST_CONFIG');
