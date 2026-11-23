import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { ListSyncCredentials } from './list-sync-adapter';

/** Marks the ciphertext format so that a later key or algorithm change can be detected. */
const FORMAT = 'v1';

/** Encrypts provider credentials with AES-256-GCM. The connection ID binds each ciphertext. */
export class CredentialCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');

    if (this.key.length !== 32) throw new Error('The provider encryption key must have 32 bytes');
  }

  encrypt(connectionId: string, credentials: ListSyncCredentials): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(connectionId));
    const data = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final(),
    ]);

    return [FORMAT, iv, cipher.getAuthTag(), data]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  decrypt(connectionId: string, value: string): ListSyncCredentials {
    const [format, iv, tag, data] = value.split('.');

    if (format !== FORMAT || !iv || !tag || data === undefined)
      throw new Error('Unknown credential format');

    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(connectionId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    const text = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64url')),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(text) as ListSyncCredentials;
  }
}
