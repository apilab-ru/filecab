import { AccountController } from './auth/account.controller';
import { PublicLibraryController } from './library/public-library.controller';
import { PAGE_RULES } from '@filecab/contracts';
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
import { CatalogGenreResolver } from './catalog/catalog-genre-resolver';
import { CatalogCacheAdminController } from './catalog/catalog-cache-admin.controller';
import { CatalogOperatorGuard } from './catalog/catalog-operator';
import { PageRulesController } from './page-rules/page-rules.controller';
import { SERVED_PAGE_RULES, servePageRules } from './page-rules/served-page-rules';
import { ListSyncController } from './list-sync/list-sync.controller';
import { ListSyncService } from './list-sync/list-sync.service';
import { ListSyncRunner } from './list-sync/list-sync-runner';
import { CredentialCipher } from './list-sync/credential-cipher';
import type { ListSyncAdapter } from './list-sync/list-sync-adapter';

/** Configures external list adapters and the job poll interval. Null disables polling. */
export interface ListSyncOptions {
  adapters: ListSyncAdapter[];
  pollMs: number | null;
}

/** Polls for list jobs every 2 seconds by default. */
const LIST_SYNC_POLL_MS = 2000;

@Module({})
export class AppModule {
  static configure(
    environment: ApiEnvironment,
    readiness?: DatabaseReadiness,
    google?: GoogleIdentityProvider,
    listSync: ListSyncOptions = { adapters: [], pollMs: LIST_SYNC_POLL_MS },
  ): DynamicModule {
    const cipher = environment.encryptionKey
      ? new CredentialCipher(environment.encryptionKey)
      : null;

    return {
      module: AppModule,
      controllers: [
        HealthController,
        AuthController,
        LibraryController,
        AccountController,
        PublicLibraryController,
        ReplicationController,
        CatalogController,
        CatalogGenreAdminController,
        CatalogCacheAdminController,
        PageRulesController,
        ListSyncController,
      ],
      providers: [
        { provide: AUTH_ENVIRONMENT, useValue: environment },
        { provide: SERVED_PAGE_RULES, useFactory: () => servePageRules(PAGE_RULES) },
        {
          provide: GOOGLE_IDENTITY,
          useFactory: () => google ?? new GoogleOAuthProvider(environment),
        },
        AuthService,
        AuthGuard,
        CatalogOperatorGuard,
        LibraryInputGuard,
        {
          provide: CatalogCacheService,
          inject: [AuthService],
          useFactory: (auth: AuthService) =>
            new CatalogCacheService(auth.database, environment.catalog.searchCacheTtlSeconds),
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
          useFactory: (auth: AuthService) =>
            new CatalogIdentityService(auth.database, new CatalogGenreResolver(auth.database)),
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
          provide: ListSyncService,
          inject: [AuthService],
          useFactory: (auth: AuthService) =>
            new ListSyncService(
              auth.database,
              listSync.adapters,
              cipher,
              `${environment.websiteOrigins[0]}/settings`,
            ),
        },
        {
          provide: ListSyncRunner,
          inject: [AuthService, LibraryMutationService],
          useFactory: (auth: AuthService, mutations: LibraryMutationService) =>
            new ListSyncRunner(
              auth.database,
              listSync.adapters,
              cipher,
              mutations,
              listSync.pollMs,
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
