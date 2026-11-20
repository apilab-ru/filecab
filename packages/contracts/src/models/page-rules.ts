import type { Category } from './category';

/** Names the page data that a declarative rule reads. */
export enum PageTextSource {
  /** Text of the first element that matches `selector`. */
  Selector = 'selector',
  /** The document title. */
  Title = 'title',
  /** The `content` of the first `meta` element whose `property` or `name` equals `selector`. */
  Meta = 'meta',
  /** The text that the user selected on the page. */
  Selection = 'selection',
}

/**
 * Reads one text value and cleans it with fixed operations. The engine applies the
 * operations in this order: `removePrefix`, `split` and `part`, `before`, `removeSuffix`.
 * All values are plain strings. A rule never contains code, expressions or patterns.
 */
export interface PageTextRule {
  source: PageTextSource;
  selector?: string;
  /** Removes the first matching prefix. */
  removePrefix?: string[];
  /** Splits the text at this separator and keeps the part at `part` (default 0). */
  split?: string;
  part?: number;
  /** Cuts the text at the first occurrence of any marker. */
  before?: string[];
  /** Removes the first matching suffix. */
  removeSuffix?: string[];
}

/** Sets a category when a text value starts with or contains a fixed marker. */
export interface PageCategoryRule {
  source: PageTextSource;
  selector?: string;
  startsWith?: string;
  contains?: string;
  category: Category;
}

/**
 * Reads a provider ID from the URL path. `path` lists fixed segments and one `:id` segment,
 * for example `/film/:id`. The ID must contain only digits.
 */
export interface PageReferenceRule {
  namespace: string;
  entity: string;
  path: string;
  category?: Category;
}

/** Describes extraction for a group of host names without a leading `www.`. */
export interface PageSiteRule {
  id: string;
  hosts: string[];
  /** The category when no category rule matches. */
  category?: Category;
  /** Title rules in order. The first nonblank result wins. */
  title: PageTextRule[];
  categories?: PageCategoryRule[];
  references?: PageReferenceRule[];
  /** The page gives only a search seed. A save from this page has no link. */
  searchOnly?: boolean;
}

/** Contains the complete, versioned page rule configuration. */
export interface PageRulesConfig {
  schemaVersion: 1;
  /** Increases with every change, also with a rollback. */
  revision: number;
  /** The minimum extension engine version that can run these rules. */
  engineVersion: number;
  /** Host names that the extension never reads. */
  excludedHosts: string[];
  /** Title rules for hosts without a site rule and for failed site rules. */
  fallback: PageTextRule[];
  sites: PageSiteRule[];
}

/** Identifies a provider record that a page names. Page references are not verified. */
export interface PageReference {
  namespace: string;
  entity: string;
  id: string;
}

/** Returns the structured page data that matching and search need. */
export interface PageExtraction {
  url: string;
  title: string;
  category: Category | null;
  references: PageReference[];
  /** The site rule that produced the title, or null for the fallback. */
  ruleId: string | null;
  searchOnly: boolean;
}
