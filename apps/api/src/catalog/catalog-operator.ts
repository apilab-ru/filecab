import { ApiErrorCode } from '@filecab/contracts';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { AUTH_CONTEXT, AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { AUTH_ENVIRONMENT } from '../auth/credentials';
import type { ApiEnvironment } from '../config/environment';
import { ApiException } from '../http/api-error';

/**
 * Allows catalog administration only to accounts in `CATALOG_OPERATOR_ACCOUNT_IDS`.
 * Local development skips authentication, so that operators can use Swagger and local tools.
 */
@Injectable()
export class CatalogOperatorGuard implements CanActivate {
  constructor(
    @Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(AuthGuard) private readonly auth: AuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.environment.mode === 'development') return true;

    await this.auth.canActivate(context);

    const identity = context.switchToHttp().getRequest<AuthenticatedRequest>()[AUTH_CONTEXT];

    if (!identity || !this.environment.catalog.operatorAccountIds.includes(identity.ownerId))
      throw new ApiException(403, ApiErrorCode.Forbidden, 'Catalog operator access is required');

    return true;
  }
}
