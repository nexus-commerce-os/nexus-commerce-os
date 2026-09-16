/**
 * Result<T, E> — an explicit success/failure value.
 *
 * The Identity domain returns expected failures (invalid email, weak password,
 * duplicate account, …) as values rather than throwing, so callers must handle
 * them and the type checker enforces exhaustiveness. Exceptions are reserved for
 * programmer errors / broken invariants.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;
