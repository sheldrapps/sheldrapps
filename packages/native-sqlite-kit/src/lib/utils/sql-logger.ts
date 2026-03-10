import { Injectable, inject } from '@angular/core';
import { NATIVE_SQLITE_HOST_CONFIG_TOKEN } from '../tokens';

@Injectable()
export class SqlLogger {
  private readonly config = inject(NATIVE_SQLITE_HOST_CONFIG_TOKEN);

  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.config.debug) {
      return;
    }

    if (meta) {
      console.info('[native-sqlite-kit]', message, meta);
      return;
    }

    console.info('[native-sqlite-kit]', message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      console.warn('[native-sqlite-kit]', message, meta);
      return;
    }

    console.warn('[native-sqlite-kit]', message);
  }
}
