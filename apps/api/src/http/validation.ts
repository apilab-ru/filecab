import { ValidationPipe, type Type, type ArgumentMetadata } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { ValidationIssue } from '@filecab/contracts';
import { ApiException } from './api-error';

/** Produces field issues without class-validator messages that may interpolate private values. */
function validationIssues(errors: ValidationError[], path: string[] = []): ValidationIssue[] {
  return errors.flatMap((error) => {
    const nextPath = [...path, error.property];

    return [
      ...Object.keys(error.constraints ?? {}).map(() => ({
        path: nextPath,
        message: 'Invalid field',
      })),
      ...validationIssues(error.children ?? [], nextPath),
    ];
  });
}

/** Rejects reserved keys before class-transformer can silently discard them. */
export class StrictValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new ApiException(
          400,
          'VALIDATION_ERROR',
          'Request validation failed',
          false,
          validationIssues(errors),
        ),
    });
  }

  protected override transformPrimitive(value: unknown, _metadata: ArgumentMetadata): unknown {
    return value;
  }

  override async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const pending = [{ value, depth: 0 }];
    while (pending.length) {
      const { value: item, depth } = pending.pop()!;

      if (item === null || typeof item !== 'object') continue;

      if (depth > 32)
        throw new ApiException(400, 'VALIDATION_ERROR', 'Request nesting exceeds the limit');

      for (const [key, child] of Object.entries(item)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key))
          throw new ApiException(400, 'VALIDATION_ERROR', 'Reserved property name');

        pending.push({ value: child, depth: depth + 1 });
      }
    }

    return super.transform(value, metadata);
  }
}

/** Selects an explicit DTO type without requiring emitted decorator metadata. */
export class RequestDtoPipe extends StrictValidationPipe {
  constructor(private readonly dto: Type<object>) {
    super();
  }

  override transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    return super.transform(value, { ...metadata, metatype: this.dto });
  }
}
