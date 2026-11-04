import { Module, type DynamicModule } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { DATABASE_READINESS, PostgresReadiness, type DatabaseReadiness } from './health/readiness';

@Module({})
export class AppModule {
  static configure(databaseUrl: string, readiness?: DatabaseReadiness): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        {
          provide: DATABASE_READINESS,
          useFactory: () => readiness ?? new PostgresReadiness(databaseUrl),
        },
      ],
    };
  }
}
