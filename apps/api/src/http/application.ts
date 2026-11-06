import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from '../app.module';
import type { ApiEnvironment } from '../config/environment';
import { COOKIE_NAMES } from '../auth/credentials';
import type { GoogleIdentityProvider } from '../auth/google';
import type { DatabaseReadiness } from '../health/readiness';
import {
  ApiException,
  ApiExceptionFilter,
  isUnsafe,
  sendApiError,
  type RequestDiagnostic,
} from './api-error';
import { StrictValidationPipe } from './validation';

/** Supplies controlled test dependencies without changing production routing. */
export interface ApiOptions {
  readiness?: DatabaseReadiness;
  google?: GoogleIdentityProvider;
  diagnostic?: (record: RequestDiagnostic) => void;
}

/** Configures the HTTP boundary shared by production and test applications. */
export function configureApiApplication(
  app: NestExpressApplication,
  environment: ApiEnvironment,
  diagnostic: (record: RequestDiagnostic) => void,
): void {
  const origins = new Set([...environment.websiteOrigins, ...environment.extensionOrigins]);
  app.disable('x-powered-by');
  app.set('trust proxy', environment.mode === 'production' ? 'loopback' : false);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(new StrictValidationPipe());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const correlationId = randomUUID();
    const started = performance.now();
    response.setHeader('X-Correlation-ID', correlationId);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.on('finish', () => {
      diagnostic({
        correlationId,
        method: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(
          request.method,
        )
          ? request.method
          : 'OTHER',
        status: response.statusCode,
        elapsedMs: Math.round(performance.now() - started),
      });
    });

    if (environment.mode === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

      if (!request.secure)
        return sendApiError(new ApiException(403, 'FORBIDDEN', 'HTTPS required'), response);
    }
    const origin = request.get('origin');

    if (origin && !origins.has(origin))
      return sendApiError(new ApiException(403, 'FORBIDDEN', 'Origin is not allowed'), response);

    if (
      isUnsafe(request) &&
      request.headers.cookie &&
      (!origin || !origins.has(origin) || request.get('x-filecab-request') !== '1')
    )
      return sendApiError(
        new ApiException(
          403,
          'FORBIDDEN',
          'Cookie request requires trusted Origin and X-Filecab-Request: 1',
        ),
        response,
      );

    if (
      isUnsafe(request) &&
      (request.headers['transfer-encoding'] ||
        Number(request.headers['content-length'] ?? 0) > 0) &&
      !request.is('application/json')
    )
      return sendApiError(
        new ApiException(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON content type required'),
        response,
      );
    next();
  });
  app.enableCors({
    origin: [...origins],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Filecab-Request'],
    exposedHeaders: ['X-Correlation-ID'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '1mb', strict: true, inflate: false });
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    sendApiError(error, response);
  });

  if (environment.mode !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Filecab API')
      .setVersion('1')
      .setDescription(
        'Versioned API. Health endpoints are anonymous. Owner endpoints require a bearer access token or an HttpOnly session cookie. Unsafe cookie requests also require an exact allowlisted Origin and X-Filecab-Request: 1; Authorization does not bypass cookie CSRF checks. Explicit null clears only fields documented as nullable; omitted fields retain their value. All errors use the common envelope and all responses carry a server-generated X-Correlation-ID. Google login and session endpoints are available; library routes follow in the next step.',
      )
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        description: 'Opaque Filecab extension access token.',
      })
      .addCookieAuth(
        COOKIE_NAMES[environment.mode === 'production' ? 'production' : 'development'].access,
        {
          type: 'apiKey',
          in: 'cookie',
          description:
            'Production Secure HttpOnly session cookie. Unsafe requests require trusted Origin and X-Filecab-Request: 1.',
        },
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    for (const path of Object.values(document.paths)) {
      for (const method of ['get', 'head', 'post', 'put', 'patch', 'delete', 'options'] as const) {
        const operation = path?.[method];

        if (!operation) continue;
        for (const response of Object.values(operation.responses)) {
          if (!response || '$ref' in response) continue;
          response.headers = {
            ...response.headers,
            'X-Correlation-ID': {
              description: 'Server-generated request UUID',
              schema: { type: 'string', format: 'uuid' },
            },
          };
        }
      }
    }
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      yamlDocumentUrl: 'api/docs-yaml',
      raw: ['json'],
      swaggerOptions: { persistAuthorization: false },
    });
  }
}

/** Creates a lazy-database API with safe HTTP diagnostics and no framework payload logging. */
export async function createApiApplication(
  environment: ApiEnvironment,
  options: ApiOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.configure(environment, options.readiness, options.google),
    { logger: false, bodyParser: false, abortOnError: false },
  );
  configureApiApplication(
    app,
    environment,
    options.diagnostic ?? ((record) => console.info(JSON.stringify(record))),
  );

  return app;
}
