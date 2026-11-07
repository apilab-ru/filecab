import { ApiErrorCode } from '@filecab/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Documents the public field-validation issue without rejected values. */
export class ValidationIssueDto {
  @ApiProperty({ type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'integer' }] } })
  path!: (string | number)[];

  @ApiProperty({ type: String, example: 'Invalid field' })
  message!: string;
}

/** Documents the common response for all HTTP error paths. */
export class ApiErrorDto {
  @ApiProperty({ type: Number, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: String, example: ApiErrorCode.ServiceUnavailable })
  code!: string;

  @ApiProperty({ type: Number, example: 503 })
  status!: number;

  @ApiProperty({ type: String, example: 'Service temporarily unavailable' })
  message!: string;

  @ApiProperty({ type: String, format: 'uuid', example: '11111111-1111-4111-8111-111111111111' })
  correlationId!: string;

  @ApiProperty({ type: Boolean, example: true })
  retryable!: boolean;

  @ApiPropertyOptional({ type: [ValidationIssueDto] })
  issues?: ValidationIssueDto[];

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  retryAfterSeconds?: number;
}

/** Documents the provider-independent health response. */
export class HealthResponseDto {
  @ApiProperty({ type: Number, enum: [1] })
  schemaVersion!: 1;

  @ApiProperty({ type: String, enum: ['ok'] })
  status!: 'ok';
}
