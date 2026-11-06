import { RequestDtoPipe } from '../http/validation';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response, CookieOptions } from 'express';
import { AuthService, type AuthIdentity, type SessionTokens } from './auth.service';
import { AuthClient, COOKIE_NAMES } from './credentials';
import { AuthGuard, CurrentAccount, readCookie } from './auth.guard';
import {
  AccountDto,
  ExtensionConfigQueryDto,
  ExtensionLoginConfigDto,
  ExchangeDto,
  ExtensionTokensDto,
  GoogleCallbackDto,
  LoginStartDto,
  RefreshDto,
} from './auth.dto';
import { ApiErrorDto } from '../http/openapi.dto';
import { ApiException } from '../http/api-error';

@ApiTags('Authentication')
@ApiResponse({
  status: 400,
  type: ApiErrorDto,
  description: 'Invalid input or callback destination',
})
@ApiResponse({
  status: 401,
  type: ApiErrorDto,
  description: 'Invalid, expired, revoked or replayed credentials',
})
@ApiResponse({
  status: 403,
  type: ApiErrorDto,
  description: 'Origin, CSRF or HTTPS requirement failed',
})
@ApiResponse({
  status: 503,
  type: ApiErrorDto,
  description: 'Google login disabled or temporarily unavailable',
})
@ApiResponse({ status: 413, type: ApiErrorDto, description: 'Request body exceeds the size limit' })
@ApiResponse({ status: 415, type: ApiErrorDto, description: 'JSON content type required' })
@ApiResponse({
  status: 500,
  type: ApiErrorDto,
  description: 'Unexpected internal failure; no private details returned',
})
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  private get names() {
    return COOKIE_NAMES[this.auth.environment.mode === 'production' ? 'production' : 'development'];
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.auth.environment.mode === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  private writeTokens(response: Response, tokens: SessionTokens): void {
    response.cookie(this.names.access, tokens.accessToken, {
      ...this.cookieOptions(),
      expires: new Date(tokens.accessExpiresAt),
    });
    response.cookie(this.names.refresh, tokens.refreshToken, {
      ...this.cookieOptions(),
      expires: new Date(tokens.sessionExpiresAt),
    });
  }

  @Get('extension/config')
  @ApiOperation({ summary: 'Check public extension login configuration', security: [] })
  @ApiQuery({ type: ExtensionConfigQueryDto })
  @ApiResponse({ status: 200, type: ExtensionLoginConfigDto })
  extensionConfig(
    @Query(new RequestDtoPipe(ExtensionConfigQueryDto)) input: ExtensionConfigQueryDto,
  ): ExtensionLoginConfigDto {
    return {
      schemaVersion: 1,
      googleEnabled: this.auth.environment.google.enabled,
      extensionAllowed: this.auth.environment.extensionOrigins.includes(
        `chrome-extension://${input.extensionId}`,
      ),
    };
  }

  @Get('google/start')
  @ApiOperation({ summary: 'Start browser-bound Google login', security: [] })
  @ApiQuery({ type: LoginStartDto })
  @ApiResponse({
    status: 302,
    description: 'Redirect to Google; sets an HttpOnly login-binding cookie',
  })
  async start(
    @Query(new RequestDtoPipe(LoginStartDto)) input: LoginStartDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.auth.start(
      input.client,
      input.returnTo,
      input.challenge,
      input.attempt,
    );
    response.cookie(this.names.login, result.binding, {
      ...this.cookieOptions(),
      maxAge: this.auth.environment.auth.loginSeconds * 1000,
    });
    response.redirect(result.url);
  }

  @Get('google/callback')
  @ApiOperation({
    summary: 'Complete Google login',
    security: [],
    description:
      'Browser-bound, single-use state. Ancillary Google parameters are ignored. Website return contains no tokens; extension return contains only a short-lived exchange code and attempt.',
  })
  @ApiQuery({ type: GoogleCallbackDto })
  @ApiResponse({ status: 302, description: 'Allowlisted website or extension redirect' })
  async callback(
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const input = (await new RequestDtoPipe(GoogleCallbackDto).transform(
      Object.fromEntries(
        ['state', 'code', 'error']
          .filter((key) => query[key] !== undefined)
          .map((key) => [key, query[key]]),
      ),
      { type: 'query' },
    )) as GoogleCallbackDto;
    const binding = readCookie(request, this.names.login);
    response.clearCookie(this.names.login, this.cookieOptions());

    if (!binding) throw new ApiException(401, 'UNAUTHORIZED', 'Authentication required');

    const result = await this.auth.callback(
      input.state,
      binding,
      input.code,
      input.error !== undefined,
    );

    if (result.tokens) this.writeTokens(response, result.tokens);

    response.redirect(result.returnTo);
  }

  @Post('exchange')
  @HttpCode(200)
  @ApiOperation({ summary: 'Redeem extension login code', security: [] })
  @ApiBody({ type: ExchangeDto })
  @ApiResponse({ status: 200, type: ExtensionTokensDto })
  async exchange(
    @Body(new RequestDtoPipe(ExchangeDto)) input: ExchangeDto,
  ): Promise<SessionTokens> {
    return this.auth.exchange(input.code, input.attempt, input.verifier);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Rotate session credentials',
    security: [],
    description:
      'Website: empty JSON body and refresh cookie, with trusted Origin and X-Filecab-Request: 1. Extension: refreshToken in JSON without cookies. Consumed refresh replay revokes the session family.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiResponse({
    status: 200,
    schema: {
      oneOf: [{ $ref: getSchemaPath(AccountDto) }, { $ref: getSchemaPath(ExtensionTokensDto) }],
    },
  })
  async refresh(
    @Body(new RequestDtoPipe(RefreshDto)) input: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountDto | SessionTokens> {
    const cookie = readCookie(request, this.names.refresh);

    if ((cookie && input.refreshToken) || request.get('authorization'))
      throw new ApiException(400, 'VALIDATION_ERROR', 'Ambiguous refresh credentials');

    const token = cookie ?? input.refreshToken;

    if (!token) throw new ApiException(401, 'UNAUTHORIZED', 'Authentication required');

    try {
      const tokens = await this.auth.refresh(
        token,
        cookie ? AuthClient.Website : AuthClient.Extension,
      );

      if (!cookie) return tokens;

      this.writeTokens(response, tokens);

      return { schemaVersion: 1, ownerId: tokens.ownerId };
    } catch (error) {
      if (cookie && error instanceof ApiException && error.httpStatus === 401)
        this.clearCookies(response);

      throw error;
    }
  }

  private assertNoInput(request: Request): void {
    if (Object.keys(request.query).length || request.body !== undefined)
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        'This operation accepts no query parameters or body',
      );
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Read authenticated account',
    security: [{ bearer: [] }, { cookie: [] }],
  })
  @ApiResponse({ status: 200, type: AccountDto })
  me(@CurrentAccount() identity: AuthIdentity, @Req() request: Request): AccountDto {
    this.assertNoInput(request);

    return { schemaVersion: 1, ownerId: identity.ownerId };
  }

  private clearCookies(response: Response): void {
    response.clearCookie(this.names.access, this.cookieOptions());
    response.clearCookie(this.names.refresh, this.cookieOptions());
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke current session', security: [{ bearer: [] }, { cookie: [] }] })
  @ApiResponse({ status: 204, description: 'Session revoked; website cookies cleared' })
  async logout(
    @CurrentAccount() identity: AuthIdentity,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertNoInput(request);
    await this.auth.logout(identity, false);

    if (identity.client === AuthClient.Website) this.clearCookies(response);
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  @ApiOperation({
    summary: 'Revoke all sessions of this account',
    security: [{ bearer: [] }, { cookie: [] }],
  })
  @ApiResponse({ status: 204, description: 'All owner sessions revoked; website cookies cleared' })
  async logoutAll(
    @CurrentAccount() identity: AuthIdentity,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.assertNoInput(request);
    await this.auth.logout(identity, true);

    if (identity.client === AuthClient.Website) this.clearCookies(response);
  }
}
