import {
  Inject,
  Injectable,
  createParamDecorator,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../http/api-error';
import { AuthService, type AuthIdentity } from './auth.service';
import { AuthClient, COOKIE_NAMES } from './credentials';

export const AUTH_CONTEXT = Symbol('AUTH_CONTEXT');

/** Adds server-derived account identity to one authenticated HTTP request. */
export interface AuthenticatedRequest extends Request {
  [AUTH_CONTEXT]?: AuthIdentity;
}

/** Reads exactly one opaque cookie without accepting duplicate credential cookies. */
export function readCookie(request: Request, name: string): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${name}=`))
    .map((item) => item.slice(name.length + 1));

  if (values.length > 1) throw new ApiException(401, 'UNAUTHORIZED', 'Authentication required');

  return values[0];
}

/** Authenticates opaque access credentials and rejects ambiguous website/bearer contexts. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const names =
      COOKIE_NAMES[this.auth.environment.mode === 'production' ? 'production' : 'development'];
    const cookie = readCookie(request, names.access);
    const refresh = readCookie(request, names.refresh);
    const header = request.get('authorization');
    const bearer = header?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];

    if ((header && (!bearer || cookie || refresh)) || (!bearer && !cookie))
      throw new ApiException(401, 'UNAUTHORIZED', 'Authentication required');
    request[AUTH_CONTEXT] = await this.auth.authenticate(
      bearer ?? cookie!,
      bearer ? AuthClient.Extension : AuthClient.Website,
    );

    return true;
  }
}

/** Supplies only the account context established by AuthGuard. */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthIdentity => {
    const identity = context.switchToHttp().getRequest<AuthenticatedRequest>()[AUTH_CONTEXT];

    if (!identity) throw new ApiException(401, 'UNAUTHORIZED', 'Authentication required');

    return identity;
  },
);
