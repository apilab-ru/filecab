import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1');
  Logger.log(`API listening at ${await app.getUrl()}`, 'Bootstrap');
}

void bootstrap();
