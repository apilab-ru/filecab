import { ReplicationController } from './library/replication.controller';
import { LibraryController, LibraryInputGuard } from './library/library.controller';
import { LibraryMutationService } from './library/mutation.service';
import { LibraryPreviewSigner } from './library/preview';
import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiEnvironment } from './config/environment';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AuthGuard } from './auth/auth.guard';
import { AUTH_ENVIRONMENT, GOOGLE_IDENTITY } from './auth/credentials';
import { GoogleOAuthProvider, type GoogleIdentityProvider } from './auth/google';
import { HealthController } from './health/health.controller';
import { DATABASE_READINESS, PostgresReadiness, type DatabaseReadiness } from './health/readiness';

@Module({})
export class AppModule {
  static configure(
    environment: ApiEnvironment,
    readiness?: DatabaseReadiness,
    google?: GoogleIdentityProvider,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AuthController, LibraryController, ReplicationController],
      providers: [
        { provide: AUTH_ENVIRONMENT, useValue: environment },
        {
          provide: GOOGLE_IDENTITY,
          useFactory: () => google ?? new GoogleOAuthProvider(environment),
        },
        AuthService,
        AuthGuard,
        LibraryInputGuard,
        {
          provide: LibraryMutationService,
          inject: [AuthService],
          useFactory: (auth: AuthService) =>
            new LibraryMutationService(
              auth.database,
              new LibraryPreviewSigner(environment.sessionSecret),
            ),
        },
        {
          provide: DATABASE_READINESS,
          useFactory: () => readiness ?? new PostgresReadiness(environment.databaseUrl),
        },
      ],
    };
  }
}
