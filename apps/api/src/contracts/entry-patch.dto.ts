import { ApiErrorCode, type Category, type Status } from '@filecab/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidatorConstraint,
  Validate,
  validateSync,
  type ValidatorConstraintInterface,
  type ValidationError,
} from 'class-validator';

const EDITABLE_FIELDS = [
  'category',
  'userTitle',
  'status',
  'rating',
  'progress',
  'comment',
  'sourceUrls',
];

@ValidatorConstraint({ name: 'sourceUrls', async: false })
class SourceUrlsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return false;

    const normalized = new Set<string>();
    for (const original of value) {
      if (typeof original !== 'string' || original.length > 8192) return false;

      try {
        const url = new URL(original);

        if (
          !/^https?:$/.test(url.protocol) ||
          url.username ||
          url.password ||
          normalized.has(url.href)
        )
          return false;

        normalized.add(url.href);
      } catch {
        return false;
      }
    }

    return true;
  }
  defaultMessage(): string {
    return 'Expected unique absolute HTTP(S) URLs without credentials';
  }
}

/** Transport allowlist only; entry-dependent semantic rules follow in mutation services. */
export class EntryPatchDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['anime', 'films', 'tv'])
  @ApiPropertyOptional({ type: String, enum: ['anime', 'films', 'tv'] })
  category?: Category;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(10000)
  @ApiPropertyOptional({
    type: String,
    maxLength: 10000,
    description: 'Exact user text. Must remain nonblank for manual entries.',
  })
  userTitle?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['planned', 'process', 'complete', 'drop', 'hide', null])
  @ApiPropertyOptional({
    type: String,
    enum: ['planned', 'process', 'complete', 'drop', 'hide', null],
    nullable: true,
    description: 'Explicit null clears status.',
  })
  status?: Status | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10)
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    maximum: 10,
    description: 'Zero means unrated.',
  })
  rating?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiPropertyOptional({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  progress?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(100000)
  @ApiPropertyOptional({
    type: String,
    maxLength: 100000,
    description: 'Empty string clears notes.',
  })
  comment?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(100)
  @Validate(SourceUrlsConstraint)
  @ApiPropertyOptional({
    type: [String],
    maxItems: 100,
    description:
      'Unique absolute HTTP(S) URLs, each at most 8192 characters. Empty array clears all sources.',
  })
  sourceUrls?: string[];
}

/** Locates a rejected request field without exposing its value. */
export interface RequestValidationIssue {
  path: (string | number)[];
  message: string;
}

export class RequestValidationError extends Error {
  readonly code = ApiErrorCode.ValidationError;
  constructor(readonly issues: RequestValidationIssue[]) {
    super('Request validation failed');
    this.name = 'RequestValidationError';
  }
}

/** Flattens nested DTO validation errors into field issues. */
function issuesFor(
  errors: ValidationError[],
  path: (string | number)[] = [],
): RequestValidationIssue[] {
  return errors.flatMap((error) => {
    const fieldPath = [...path, error.property];

    return [
      ...Object.values(error.constraints ?? {}).map((message) => ({ path: fieldPath, message })),
      ...issuesFor(error.children ?? [], fieldPath),
    ];
  });
}

/** Validates an entry patch request without coercing values or accepting unknown fields. */
export function validateEntryPatchDto(input: unknown): EntryPatchDto {
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    Object.getPrototypeOf(input) !== Object.prototype
  )
    throw new RequestValidationError([{ path: [], message: 'Expected request object' }]);

  // Transform only after checking the original allowlist: class-transformer deliberately
  // discards some dangerous property names rather than reporting them as unknown.
  const unknown = Object.keys(input).filter((key) => !EDITABLE_FIELDS.includes(key));

  if (unknown.length)
    throw new RequestValidationError(
      unknown.map((key) => ({ path: [key], message: 'Unknown field' })),
    );

  const dto = plainToInstance(EntryPatchDto, input, { enableImplicitConversion: false });
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });

  if (errors.length) throw new RequestValidationError(issuesFor(errors));

  return dto;
}
