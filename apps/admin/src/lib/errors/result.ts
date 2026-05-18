export type DomainError<TCode extends string = string> = {
  error: TCode;
  message?: string;
  status?: number;
  details?: unknown;
};

export type Result<T, E extends object = DomainError> =
  | { ok: true; data: T }
  | ({ ok: false } & E);

export function ok<T>(data: T): Result<T, never> {
  return { ok: true, data };
}

export function err<E extends object>(error: E): Result<never, E> {
  return { ok: false, ...error };
}

export function isOk<T, E extends object>(
  result: Result<T, E>,
): result is { ok: true; data: T } {
  return result.ok;
}
