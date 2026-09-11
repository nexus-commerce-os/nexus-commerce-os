import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadIdentityConfig } from './config/identity-config';
import { IdentityModule, API_PREFIX } from './nest/identity.module';

/**
 * Process entry point. Deliberately thin: everything it does beyond starting a
 * server lives in a tested unit — configuration in `loadIdentityConfig`, the
 * object graph in the composition root.
 *
 * Configuration is validated before anything else, so a misconfigured
 * deployment dies at boot with the full list of problems rather than failing on
 * the first request that needs a missing value.
 */
async function bootstrap(): Promise<void> {
  const config = loadIdentityConfig(process.env);
  if (!config.ok) {
    console.error(config.error.message);
    process.exit(1);
    return;
  }

  const app = await NestFactory.create(IdentityModule.forRoot(config.value));
  // The contract declares `servers: /v1`; the prefix belongs here, not in a
  // route string, so a version bump is one line rather than every controller.
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.listen(config.value.port);
}

void bootstrap();
