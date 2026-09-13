/**
 * Nominal ("branded") typing helper.
 *
 * `Brand<string, 'UserId'>` is assignable from neither a raw `string` nor a
 * differently-branded id, so identifiers from different aggregates cannot be
 * mixed up at compile time. The brand exists only in the type system.
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };
