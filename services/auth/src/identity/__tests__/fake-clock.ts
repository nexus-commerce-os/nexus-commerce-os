import type { Clock } from '../../kernel/clock';

/**
 * FakeClock — the test double for the {@link Clock} port. Time only moves when a
 * test moves it, so every expiry/boundary assertion is deterministic (no sleeps,
 * no wall-clock flakiness).
 *
 * `set` can move time *backwards* as well, which is how the clock-drift tests
 * prove that a consumed or expired token never becomes valid again.
 */
export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(when: Date): void {
    this.current = new Date(when.getTime());
  }
}
