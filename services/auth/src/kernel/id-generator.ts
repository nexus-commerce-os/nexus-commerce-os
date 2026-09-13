/**
 * IdGenerator port — the domain never generates ids directly, so id creation is
 * injectable (real UUID in production, deterministic sequence in tests).
 */
export interface IdGenerator {
  generate(): string;
}
