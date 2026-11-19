import { describe, expect, it } from 'vitest';
import { isViewingUrl, sourceLines } from './entry-form';

describe('entry form', () => {
  it('accepts only absolute HTTP and HTTPS viewing links', () => {
    expect(isViewingUrl('https://example.test/watch?id=001#episode')).toBe(true);
    expect(isViewingUrl('http://example.test')).toBe(true);
    expect(isViewingUrl('javascript:alert(1)')).toBe(false);
    expect(isViewingUrl('ftp://example.test/file')).toBe(false);
    expect(isViewingUrl('example.test/watch')).toBe(false);
  });

  it('ignores blank lines and surrounding spaces', () => {
    expect(sourceLines('  https://a.test \n\n https://b.test\n')).toEqual([
      'https://a.test',
      'https://b.test',
    ]);
  });
});
