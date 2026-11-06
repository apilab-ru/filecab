import { createHash, createHmac, randomBytes } from 'node:crypto';

export enum AuthClient {
  Website = 'website',
  Extension = 'extension',
}

export const AUTH_ENVIRONMENT = Symbol('AUTH_ENVIRONMENT');

export const GOOGLE_IDENTITY = Symbol('GOOGLE_IDENTITY');

export const COOKIE_NAMES = {
  development: { access: 'filecab-access', refresh: 'filecab-session', login: 'filecab-login' },
  production: {
    access: '__Host-filecab-access',
    refresh: '__Host-filecab-session',
    login: '__Host-filecab-login',
  },
};

/** Generates a 256-bit random opaque URL-safe credential. */
export function randomCredential(): string {
  return randomBytes(32).toString('base64url');
}

/** Hashes persisted Filecab credentials with the server-held session key. */
export function credentialHash(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** Computes the standard S256 challenge for an OAuth or extension verifier. */
export function verifierChallenge(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}
