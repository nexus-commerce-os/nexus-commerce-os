/**
 * Raised when a conditional write matched no row — another transaction already
 * moved the aggregate out of the state this save assumed.
 *
 * This is what enforces the single-use contract the consumable ports declare
 * (`UPDATE … WHERE status = 'pending'`): the in-process check inside an
 * aggregate cannot span connections, so the database has to arbitrate. Losing
 * the race fails closed — nothing is written — rather than letting a token be
 * spent twice.
 *
 * It is thrown, not returned as a `Result`: the use cases model *domain*
 * outcomes as values, and a lost write race is an infrastructure condition the
 * caller retries or surfaces as a transient error. Mapping it to a friendlier
 * response belongs to the HTTP layer (I-7).
 */
export class ConcurrentModificationError extends Error {
  readonly _tag = 'ConcurrentModificationError';

  constructor(
    public readonly aggregate: string,
    public readonly id: string,
  ) {
    super(
      `${aggregate} "${id}" was modified concurrently; the conditional write matched no row.`,
    );
    this.name = 'ConcurrentModificationError';
  }
}

/** Throws unless the conditional write claimed exactly the row it expected. */
export function assertClaimed(
  rowCount: number | null,
  aggregate: string,
  id: string,
): void {
  if ((rowCount ?? 0) === 0) {
    throw new ConcurrentModificationError(aggregate, id);
  }
}
