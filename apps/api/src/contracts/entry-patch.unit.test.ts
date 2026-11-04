import 'reflect-metadata';
import { expect, test } from 'vitest';
import { RequestValidationError, validateEntryPatchDto } from './entry-patch.dto';

test('server DTO preserves exact text and supports omitted fields and explicit clears', () => {
  const value = {
    userTitle: '  Exact\n',
    status: null,
    rating: 0,
    progress: 0,
    comment: '',
    sourceUrls: [],
  };
  expect(validateEntryPatchDto(value)).toMatchObject(value);
  expect(validateEntryPatchDto({})).toBeDefined();
  expect(validateEntryPatchDto({ progress: Number.MAX_SAFE_INTEGER }).progress).toBe(
    Number.MAX_SAFE_INTEGER,
  );
});

test('server DTO rejects primitive coercion, invalid values, forbidden nulls and server-owned fields', () => {
  for (const input of [
    { rating: '3' },
    { rating: null },
    { rating: 1.5 },
    { rating: 11 },
    { progress: -1 },
    { progress: Number.MAX_SAFE_INTEGER + 1 },
    { category: null },
    { status: 'watched' },
    { userTitle: null },
    { comment: null },
    { serverVersion: '1' },
    { entryId: 'other' },
    [],
    null,
    'text',
  ])
    expect(() => validateEntryPatchDto(input)).toThrow(RequestValidationError);
});

test('server DTO rejects unsafe/duplicate viewing sources and forbidden property names without exposing text', () => {
  for (const sourceUrls of [
    null,
    'url',
    [1],
    ['javascript:alert(1)'],
    ['https://user:pass@example.com'],
    ['https://EXAMPLE.com', 'https://example.com/'],
    Array(101).fill('https://example.com'),
  ])
    expect(() => validateEntryPatchDto({ sourceUrls })).toThrow(RequestValidationError);
  const original = 'HTTPS://EXAMPLE.COM:443/Title/?b=2&a=1#Part';
  expect(validateEntryPatchDto({ sourceUrls: [original] }).sourceUrls).toEqual([original]);
  expect(() => validateEntryPatchDto(JSON.parse('{"__proto__": {}}'))).toThrow(
    RequestValidationError,
  );
  try {
    validateEntryPatchDto({ userTitle: 'secret title', rating: 'secret value' });
    throw new Error('Expected failure');
  } catch (error) {
    expect(error).toBeInstanceOf(RequestValidationError);
    expect(JSON.stringify(error)).not.toContain('secret');
    expect((error as RequestValidationError).issues[0].path).toEqual(['rating']);
  }
});
