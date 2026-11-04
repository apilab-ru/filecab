import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DATABASE_READINESS, type DatabaseReadiness } from './readiness';
import { ApiException } from '../http/api-error';
import { ApiErrorDto, HealthResponseDto } from '../http/openapi.dto';

/** Enforces the health endpoint's empty query allowlist. */
function checkQuery(query: Record<string, unknown>): void {
  if (Object.keys(query).length)
    throw new ApiException(400, 'VALIDATION_ERROR', 'Query parameters are not supported');
}

@ApiTags('Health')
@ApiResponse({
  status: 400,
  type: ApiErrorDto,
  description: 'Unsupported query or invalid request',
})
@ApiResponse({
  status: 403,
  type: ApiErrorDto,
  description: 'Origin or HTTPS policy rejected the request',
})
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_READINESS) private readonly database: DatabaseReadiness) {}

  @Get('live')
  @ApiOperation({
    summary: 'Process liveness',
    description: 'Anonymous. Does not contact the database or any provider.',
    security: [],
  })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  live(@Query() query: Record<string, unknown>): HealthResponseDto {
    checkQuery(query);

    return { schemaVersion: 1, status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Database readiness',
    description:
      'Anonymous. Performs a bounded PostgreSQL probe; independent of external providers.',
    security: [],
  })
  @ApiResponse({ status: 200, type: HealthResponseDto })
  @ApiResponse({
    status: 503,
    type: ApiErrorDto,
    description: 'Database is unavailable; retry later',
  })
  async ready(@Query() query: Record<string, unknown>): Promise<HealthResponseDto> {
    checkQuery(query);
    try {
      await this.database.check();
    } catch {
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable', true);
    }

    return { schemaVersion: 1, status: 'ok' };
  }
}
