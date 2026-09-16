import { SetMetadata } from '@nestjs/common';
import { RATE_LIMITED_OPERATION } from './rate-limit.guard';

/**
 * Mark an operation for abuse protection, naming it by its OpenAPI
 * `operationId`. The decorator carries only the name; thresholds live in
 * configuration, so tuning product policy never means editing a controller.
 *
 * Deliberately metadata-only. `RateLimitGuard` is registered globally
 * (`APP_GUARD`), which guarantees it runs *before* any route-level guard — an
 * unauthenticated flood is rejected before it can cost a session lookup. Adding
 * a second `@UseGuards()` to a method that already has one would instead
 * overwrite the first, silently dropping authentication.
 */
export function RateLimited(operationId: string): MethodDecorator {
  return SetMetadata(RATE_LIMITED_OPERATION, operationId);
}
