import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiError, ApiErrorCode, ValidationIssue } from '@filecab/contracts';
import { RequestValidationError } from '../contracts/entry-patch.dto';
import { MutationError } from '../library/mutation.service';

type ErrorCode = `${ApiErrorCode}`;

const HTTP_ERRORS: Record<number, [ErrorCode, string]> = {
  400: ['VALIDATION_ERROR', 'Invalid request'],
  401: ['UNAUTHORIZED', 'Authentication required'],
  403: ['FORBIDDEN', 'Request forbidden'],
  404: ['NOT_FOUND', 'Resource not found'],
  409: ['CONFLICT', 'State conflict'],
  413: ['PAYLOAD_TOO_LARGE', 'Request body exceeds the size limit'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'JSON content type required'],
  429: ['RATE_LIMITED', 'Too many requests'],
  503: ['SERVICE_UNAVAILABLE', 'Service temporarily unavailable'],
};

/** Describes an intentional failure without retaining a private payload or underlying error. */
export class ApiException extends HttpException {
  constructor(
    readonly httpStatus: number,
    readonly code: ErrorCode,
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
      'VALIDATION_ERROR',
      'Request validation failed',
      false,
      error.issues,
    );

  if (error instanceof MutationError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;

    return new ApiException(
      status,
      error.code,
      status === 404
        ? 'Resource not found'
        : status === 409
          ? 'State conflict'
          : 'Request validation failed',
    );
  }

  const status =
    error instanceof HttpException
      ? error.getStatus()
      : typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof error.status === 'number'
        ? error.status
        : 500;

  const [code, message] = HTTP_ERRORS[status] ?? ['INTERNAL_ERROR', 'Internal server error'];

  const httpStatus = HTTP_ERRORS[status] ? status : 500;

  return new ApiException(httpStatus, code, message, httpStatus === 429 || httpStatus >= 500);
}

/** Writes the common envelope for controller, middleware and body-parser failures. */
export function sendApiError(error: unknown, response: Response): void {
  const safe = publicError(error);
  const body: Omit<ApiError, 'code'> & { code: ErrorCode } = {
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
