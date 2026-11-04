import 'reflect-metadata';
import { loadEnvironment } from './config/environment';
import { createApiApplication } from './http/application';

/** Starts the loopback API after validating operator configuration. */
async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await createApiApplication(environment);
  app.enableShutdownHooks();
  await app.listen(environment.port, '127.0.0.1');
  console.info('API started');
}

void bootstrap().catch(() => {
  // Do not log arbitrary exception messages: driver/startup errors can contain secrets.
  console.error('API startup failed; verify server configuration and availability');
  process.exitCode = 1;
});
