import {
  ApiErrorCode,
  type Entry,
  type LibraryMutationPreview,
  type ServerEntry,
} from '@filecab/contracts';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { MutationError } from './proposals';

const PREVIEW_LIFETIME_MS = 5 * 60 * 1000;

/** Serializes JSON deterministically while preserving array/source order and omitting absent fields. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;

  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([a], [b]) => {
        if (a < b) return -1;

        return a > b ? 1 : 0;
      })
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(',')}}`;

  return JSON.stringify(value) ?? 'null';
}

/** Signs previews without embedding private document content into the confirmation token. */
export class LibraryPreviewSigner {
  constructor(private readonly secret: string) {}

  private digest(ownerId: string, kind: string, input: unknown, before: ServerEntry[]): string {
    return createHash('sha256').update(canonical({ ownerId, kind, input, before })).digest('hex');
  }

  private signature(payload: string): Buffer {
    return createHmac('sha256', this.secret)
      .update(`filecab-library-preview-v1:${payload}`)
      .digest();
  }

  create(
    ownerId: string,
    kind: string,
    input: unknown,
    before: ServerEntry[],
    proposed: ServerEntry[],
  ): LibraryMutationPreview {
    const expires = Date.now() + PREVIEW_LIFETIME_MS;
    const payload = `${expires}.${this.digest(ownerId, kind, input, before)}`;

    return {
      schemaVersion: 1,
      previewToken: `${payload}.${this.signature(payload).toString('base64url')}`,
      expiresAt: new Date(expires).toISOString(),
      changes: before.map((entry, index) => ({
        before: entry,
        proposed: { ...proposed[index], serverVersion: null } as Entry,
      })),
    };
  }

  verify(
    token: string,
    ownerId: string,
    kind: string,
    input: unknown,
    before: ServerEntry[],
  ): void {
    if (!/^\d{13}\.[0-9a-f]{64}\.[A-Za-z0-9_-]{43}$/.test(token))
      throw new MutationError(ApiErrorCode.Conflict);

    const [expires, digest, signature] = token.split('.');
    const payload = `${expires}.${digest}`;
    const supplied = Buffer.from(signature, 'utf8');
    const expected = Buffer.from(this.signature(payload).toString('base64url'), 'utf8');

    if (
      Number(expires) <= Date.now() ||
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected) ||
      digest !== this.digest(ownerId, kind, input, before)
    )
      throw new MutationError(ApiErrorCode.Conflict);
  }
}
