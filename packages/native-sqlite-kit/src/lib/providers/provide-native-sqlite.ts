import { APP_INITIALIZER, Provider } from '@angular/core';
import { NativeSqliteHostConfig } from '../contracts';
import { CapacitorSqliteDriver } from '../driver';
import {
  NativeSqliteManager,
  SqliteBootstrapService,
  SqliteMigrationRunnerService,
  SqliteTransactionManagerService,
} from '../services';
import {
  NATIVE_SQLITE_HOST_CONFIG_TOKEN,
  SQLITE_DRIVER_TOKEN,
} from '../tokens';
import { SqlLogger, validateNativeSqliteHostConfig } from '../utils';

export interface ProvideNativeSqliteConfig extends NativeSqliteHostConfig {
  initializeOnAppBootstrap?: boolean;
}

export function provideNativeSqlite(
  config: ProvideNativeSqliteConfig
): Provider[] {
  const normalizedConfig = validateNativeSqliteHostConfig(config);
  const initializeOnAppBootstrap = config.initializeOnAppBootstrap !== false;

  return [
    {
      provide: NATIVE_SQLITE_HOST_CONFIG_TOKEN,
      useValue: normalizedConfig,
    },
    SqlLogger,
    {
      provide: SQLITE_DRIVER_TOKEN,
      useClass: CapacitorSqliteDriver,
    },
    SqliteMigrationRunnerService,
    NativeSqliteManager,
    SqliteTransactionManagerService,
    SqliteBootstrapService,
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [SqliteBootstrapService],
      useFactory: (bootstrap: SqliteBootstrapService) => {
        return () => {
          if (!initializeOnAppBootstrap) {
            return Promise.resolve();
          }

          return bootstrap.bootstrap();
        };
      },
    },
  ];
}
