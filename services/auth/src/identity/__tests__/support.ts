import type { Clock } from '../../kernel/clock';

/** Deterministic clock for tests. */
export class FixedClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export const STRONG_PASSWORD = 'Sup3rSecret-Pw!';
export const OTHER_STRONG_PASSWORD = 'An0ther-Str0ng-Pw!';
