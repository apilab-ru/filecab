import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnvironment } from './config/environment';

async function bootstrap() {
  const environment = loadEnvironment();
  const app = await NestFactory.create(AppModule);
  await app.listen(environment.port, '127.0.0.1');
  Logger.log(`API listening at ${await app.getUrl()}`, 'Bootstrap');
}

void bootstrap().catch((error: unknown) => {
  // Configuration errors contain field names only, never submitted values.
  Logger.error(
    error instanceof Error ? error.message : 'API startup failed',
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
