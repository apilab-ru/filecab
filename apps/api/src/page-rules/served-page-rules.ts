import { createHash } from 'node:crypto';
import type { PageRulesConfig } from '@filecab/contracts';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PageRulesConfigDto } from './page-rules.dto';

export const SERVED_PAGE_RULES = Symbol('SERVED_PAGE_RULES');

/** Carries the validated configuration and its HTTP cache validator. */
export interface ServedPageRules {
  config: PageRulesConfig;
  etag: string;
}

/** Lists every site ID and host that occurs more than once. */
function duplicates(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

/**
 * Validates the reviewed page rule file. An invalid file throws, so the API does not start.
 * The ETag changes with the revision and with any change of content.
 */
export function servePageRules(config: unknown): ServedPageRules {
  const dto = plainToInstance(PageRulesConfigDto, config);
  const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
  const rules = config as PageRulesConfig;
  const repeated = errors.length
    ? []
    : duplicates([
        ...rules.sites.map(({ id }) => `site ${id}`),
        ...rules.sites.flatMap(({ hosts }) => hosts.map((host) => `host ${host}`)),
      ]);

  if (errors.length || repeated.length)
    throw new Error(
      `Invalid page rule configuration: ${
        errors.map(({ property }) => property).join(', ') || repeated.join(', ')
      }`,
    );

  const body = JSON.stringify(rules);
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 16);

  return { config: rules, etag: `"${rules.revision}-${hash}"` };
}
