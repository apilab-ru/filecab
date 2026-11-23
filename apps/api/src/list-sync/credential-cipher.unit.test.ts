import { expect, test } from 'vitest';
import { CredentialCipher } from './credential-cipher';

const cipher = new CredentialCipher(Buffer.alloc(32, 7).toString('base64'));

const credentials = { accessToken: 'token', refreshToken: 'refresh', expiresAt: null, scopes: [] };

test('round-trips credentials without plain text in the ciphertext', () => {
  const value = cipher.encrypt('connection-1', credentials);
  expect(value).not.toContain('token');
  expect(cipher.decrypt('connection-1', value)).toEqual(credentials);
});

test('rejects a ciphertext of another connection or a changed ciphertext', () => {
  const value = cipher.encrypt('connection-1', credentials);
  expect(() => cipher.decrypt('connection-2', value)).toThrow();
  const parts = value.split('.');
  const data = parts[3]!;
  parts[3] = `${data.startsWith('A') ? 'B' : 'A'}${data.slice(1)}`;
  expect(() => cipher.decrypt('connection-1', parts.join('.'))).toThrow();
});
