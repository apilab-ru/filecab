import { describe, expect, it } from 'vitest';
import { isViewingUrl } from './entry-form';

describe('entry form', () => {
  it('accepts only absolute HTTP and HTTPS viewing links', () => {
    expect(isViewingUrl('https://example.test/watch?id=001#episode')).toBe(true);
    expect(isViewingUrl('http://example.test')).toBe(true);
    expect(isViewingUrl('javascript:alert(1)')).toBe(false);
    expect(isViewingUrl('ftp://example.test/file')).toBe(false);
    expect(isViewingUrl('example.test/watch')).toBe(false);
  });
});
