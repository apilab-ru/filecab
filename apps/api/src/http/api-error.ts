import { ApiErrorCode, type ApiError, type ValidationIssue } from '@filecab/contracts';
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestValidationError } from '../contracts/entry-patch.dto';
import { MutationError } from '../library/mutation.service';

const HTTP_ERRORS: Record<number, [ApiErrorCode, string]> = {
  400: [ApiErrorCode.ValidationError, 'Invalid request'],
  401: [ApiErrorCode.Unauthorized, 'Authentication required'],
  403: [ApiErrorCode.Forbidden, 'Request forbidden'],
  404: [ApiErrorCode.NotFound, 'Resource not found'],
  409: [ApiErrorCode.Conflict, 'State conflict'],
  413: [ApiErrorCode.PayloadTooLarge, 'Request body exceeds the size limit'],
  415: [ApiErrorCode.UnsupportedMediaType, 'JSON content type required'],
  429: [ApiErrorCode.RateLimited, 'Too many requests'],
  502: [ApiErrorCode.InvalidResponse, 'Catalog provider returned an invalid response'],
  503: [ApiErrorCode.ServiceUnavailable, 'Service temporarily unavailable'],
};

const MUTATION_HTTP_STATUSES = {
  [ApiErrorCode.NotFound]: 404,
  [ApiErrorCode.Conflict]: 409,
  [ApiErrorCode.ValidationError]: 400,
};

/** Describes an intentional failure without retaining a private payload or underlying error. */
export class ApiException extends HttpException {
  constructor(
    readonly httpStatus: number,
    readonly code: ApiErrorCode,
    readonly safeMessage: string,
    readonly retryable = false,
    readonly issues?: ValidationIssue[],
  ) {
    super(safeMessage, httpStatus);
  }
}

/** Converts framework and internal failures to a safe, stable public error. */
function publicError(error: unknown): ApiException {
  if (error instanceof ApiException) return error;

  if (error instanceof RequestValidationError)
    return new ApiException(
      400,
      ApiErrorCode.ValidationError,
      'Request validation failed',
      false,
      error.issues,
    );

  if (error instanceof MutationError) {
    const status = MUTATION_HTTP_STATUSES[error.code];
    const message = status === 400 ? 'Request validation failed' : HTTP_ERRORS[status][1];

    return new ApiException(status, error.code, message);
  }

  let status = 500;

  if (error instanceof HttpException) {
    status = error.getStatus();
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    status = error.status;
  }

  const [code, message] = HTTP_ERRORS[status] ?? [
    ApiErrorCode.InternalError,
    'Internal server error',
  ];

  const httpStatus = HTTP_ERRORS[status] ? status : 500;

  return new ApiException(httpStatus, code, message, httpStatus === 429 || httpStatus >= 500);
}

/** Writes the common envelope for controller, middleware and body-parser failures. */
export function sendApiError(error: unknown, response: Response): void {
  const safe = publicError(error);
  const body: ApiError = {
    schemaVersion: 1,
    code: safe.code,
    status: safe.httpStatus,
    message: safe.safeMessage,
    correlationId: String(response.getHeader('X-Correlation-ID')),
    retryable: safe.retryable,
    ...(safe.issues ? { issues: safe.issues } : {}),
  };
  response.status(safe.httpStatus).json(body);
}

/** Prevents exception details and submitted values from escaping controller errors. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!response.headersSent) sendApiError(error, response);
  }
}

/** Records only operational fields; request paths, content, credentials and exceptions are omitted. */
export interface RequestDiagnostic {
  correlationId: string;
  method: string;
  status: number;
  elapsedMs: number;
}

/** Identifies unsafe methods independently of request authentication. */
export function isUnsafe(request: Request): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
}
