import { PAGE_RULES, type PageRulesConfig } from '@filecab/contracts';
import { describe, expect, it } from 'vitest';
import { servePageRules } from './served-page-rules';

/** Copies the reviewed rules so that a test can break one value. */
function copy(): PageRulesConfig {
  return structuredClone(PAGE_RULES);
}

describe('served page rules', () => {
  it('accepts the reviewed file and gives an ETag that follows its content', () => {
    const served = servePageRules(PAGE_RULES);
    const changed = copy();
    changed.sites[0]!.title.push({ source: 'title' as never });

    expect(served.etag).toMatch(new RegExp(`^"${PAGE_RULES.revision}-`));
    expect(servePageRules(changed).etag).not.toBe(served.etag);
  });

  it('rejects unknown fields, unknown sources, bad hosts and repeated hosts', () => {
    const script = copy();
    (script.sites[0] as unknown as Record<string, unknown>).script = 'alert(1)';
    const source = copy();
    (source.fallback[0] as unknown as Record<string, unknown>).source = 'eval';
    const host = copy();
    host.sites[0]!.hosts = ['https://animego.org'];
    const repeated = copy();
    repeated.sites[1]!.hosts = [repeated.sites[0]!.hosts[0]!];

    for (const config of [script, source, host, repeated])
      expect(() => servePageRules(config)).toThrow('Invalid page rule configuration');
  });
});
