export type NativeSqliteErrorCode =
  | 'DATABASE_NOT_INITIALIZED'
  | 'DATABASE_OPEN_FAILURE'
  | 'MIGRATION_FAILURE'
  | 'TRANSACTION_FAILURE'
  | 'INVALID_SQL_EXECUTION'
  | 'DUPLICATE_INITIALIZATION'
  | 'UNSUPPORTED_RUNTIME_STATE'
  | 'CONNECTION_STATE_INVALID'
  | 'CONFIG_VALIDATION_FAILURE';

export interface NativeSqliteErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
}

export class NativeSqliteError extends Error {
  override readonly name = 'NativeSqliteError';

  constructor(
    readonly code: NativeSqliteErrorCode,
    message: string,
    readonly options: NativeSqliteErrorOptions = {}
  ) {
    super(message);
    if (options.cause !== undefined && !('cause' in this)) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  get details(): Record<string, unknown> | undefined {
    return this.options.details;
  }

  get cause(): unknown {
    return this.options.cause;
  }
}
