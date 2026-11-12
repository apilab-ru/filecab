import './instrumentation/sentry';
import 'reflect-metadata';
import { loadEnvironment, startupFailureMessage } from './config/environment';
import { createApiApplication } from './http/application';

/** Starts the loopback API after validating operator configuration. */
async function bootstrap(): Promise<void> {
  const environment = loadEnvironment();
  const app = await createApiApplication(environment);
  app.enableShutdownHooks();
  await app.listen(environment.port, '127.0.0.1');
  console.info(`API started at ${await app.getUrl()}`);
}

void bootstrap().catch((error: unknown) => {
  // Do not log arbitrary exception messages: driver/startup errors can contain secrets.
  console.error(startupFailureMessage(error));
  process.exitCode = 1;
});
