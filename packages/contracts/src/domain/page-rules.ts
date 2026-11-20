import type { PageRulesConfig } from '../models/page-rules';
import rules from './page-rules.json' with { type: 'json' };

/** The reviewed page rule configuration. The API serves it and the extension bundles it. */
export const PAGE_RULES = rules as PageRulesConfig;
