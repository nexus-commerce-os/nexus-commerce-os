import type { Clock } from '../../kernel/clock';

/** Clock backed by the system wall clock. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
