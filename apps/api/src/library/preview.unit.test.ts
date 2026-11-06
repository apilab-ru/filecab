import { afterEach, expect, test, vi } from 'vitest';
import type { ServerEntry } from '@filecab/contracts';
import { LibraryPreviewSigner } from './preview';

const signer = new LibraryPreviewSigner('synthetic-preview-key');
const before = [{ entryId: 'fixture', serverVersion: '1' }] as ServerEntry[];

afterEach(() => {
  vi.useRealTimers();
});

test('preview signatures bind owner, operation and canonical choices and expire after five minutes', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T00:00:00.000Z'));
  const preview = signer.create('owner', 'merge', { a: 1, b: 2 }, before, before);
  expect(() =>
    signer.verify(preview.previewToken, 'owner', 'merge', { b: 2, a: 1 }, before),
  ).not.toThrow();
  expect(() =>
    signer.verify(preview.previewToken, 'another-owner', 'merge', { a: 1, b: 2 }, before),
  ).toThrow();
  expect(() =>
    signer.verify(preview.previewToken, 'owner', 'reassign-source', { a: 1, b: 2 }, before),
  ).toThrow();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = preview.previewToken.at(-1)!;
  const noncanonical = preview.previewToken.slice(0, -1) + alphabet[alphabet.indexOf(last) + 1];
  expect(() => signer.verify(noncanonical, 'owner', 'merge', { a: 1, b: 2 }, before)).toThrow();
  vi.advanceTimersByTime(5 * 60 * 1000);
  expect(() =>
    signer.verify(preview.previewToken, 'owner', 'merge', { a: 1, b: 2 }, before),
  ).toThrow();
});
