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
import { CatalogController } from './catalog/catalog.controller';
import { CatalogIdentityService } from './catalog/catalog-identity.service';
import { CatalogSearchService } from './catalog/catalog-search.service';
import { CatalogCacheService } from './catalog/catalog-cache.service';
import { CatalogGenreAdminController } from './catalog/catalog-genre-admin.controller';
import { CatalogGenreService } from './catalog/catalog-genre.service';
import { SmotretAnimeAdapter } from './catalog/smotret-anime.adapter';
import { KinopoiskDevAdapter } from './catalog/kinopoisk-dev.adapter';

@Module({})
export class AppModule {
  static configure(
    environment: ApiEnvironment,
    readiness?: DatabaseReadiness,
    google?: GoogleIdentityProvider,
  ): DynamicModule {
    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        LibraryController,
        ReplicationController,
        CatalogController,
        CatalogGenreAdminController,
      ],
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
          provide: CatalogCacheService,
          inject: [AuthService],
          useFactory: (auth: AuthService) => new CatalogCacheService(auth.database),
        },
        {
          provide: CatalogSearchService,
          inject: [CatalogCacheService, CatalogIdentityService],
          useFactory: (cache: CatalogCacheService, identity: CatalogIdentityService) => {
            const adapters = [
              ...(environment.providers.smotret.enabled
                ? [
                    new SmotretAnimeAdapter(
                      environment.providers.smotret.origin,
                      environment.catalog,
                      identity,
                      'Filecab catalog integration',
                    ),
                  ]
                : []),
              ...(environment.providers.kinopoisk.enabled && environment.providers.kinopoisk.apiKey
                ? [
                    new KinopoiskDevAdapter(
                      environment.providers.kinopoisk.origin,
                      environment.providers.kinopoisk.apiKey,
                      identity,
                    ),
                  ]
                : []),
            ];

            return new CatalogSearchService(adapters, cache);
          },
        },
        {
          provide: CatalogGenreService,
          inject: [AuthService],
          useFactory: (auth: AuthService) =>
            new CatalogGenreService(auth.database, environment.catalog, []),
        },
        {
          provide: CatalogIdentityService,
          inject: [AuthService],
          useFactory: (auth: AuthService) => new CatalogIdentityService(auth.database),
        },
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
