import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../kernel/id-generator';

/** IdGenerator backed by Node's cryptographically-strong `randomUUID` (v4). */
export class UuidIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
