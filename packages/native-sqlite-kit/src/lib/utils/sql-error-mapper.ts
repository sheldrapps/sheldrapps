import { NativeSqliteError, NativeSqliteErrorCode } from '../errors';

export function mapSqlError(
  code: NativeSqliteErrorCode,
  message: string,
  cause: unknown,
  details?: Record<string, unknown>
): NativeSqliteError {
  if (cause instanceof NativeSqliteError) {
    return cause;
  }

  return new NativeSqliteError(code, message, {
    cause,
    details,
  });
}
