import type {
  Category,
  PageExtraction,
  PageReference,
  PageSiteRule,
  PageTextRule,
} from '@filecab/contracts';

/**
 * Extracts a title, category and provider references from the current document.
 * `chrome.scripting.executeScript` serializes this function and runs it in the page, so it
 * must not use imports, module values or closures. Rules are data: the function never
 * evaluates rule text as code, and it ignores unknown sources and malformed values.
 */
export function extractPage(site: PageSiteRule | null, fallback: PageTextRule[]): PageExtraction {
  const maxLength = 300;
  const categories = ['anime', 'films', 'tv'];
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const clean = (value: unknown) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

  /** Reads the raw text that one rule names. */
  function read(rule: { source?: unknown; selector?: unknown }): string {
    const selector = typeof rule.selector === 'string' ? rule.selector : '';

    if (rule.source === 'title') return document.title;

    if (rule.source === 'selection') return String(window.getSelection?.() ?? '');

    if (rule.source === 'selector' && selector) {
      try {
        return document.querySelector(selector)?.textContent ?? '';
      } catch {
        return '';
      }
    }

    if (rule.source === 'meta' && selector) {
      const meta = Array.from(document.querySelectorAll('meta')).find(
        (element) =>
          element.getAttribute('property') === selector ||
          element.getAttribute('name') === selector,
      );

      return meta?.getAttribute('content') ?? '';
    }

    return '';
  }

  /** Applies the fixed cleanup operations of one title rule. */
  function apply(rule: PageTextRule): string {
    let text = clean(read(rule));
    const prefix = strings(rule.removePrefix).find((value) => value && text.startsWith(value));

    if (prefix) text = text.slice(prefix.length);

    if (typeof rule.split === 'string' && rule.split) {
      const part = Number.isSafeInteger(rule.part) ? Number(rule.part) : 0;
      text = text.split(rule.split)[part] ?? '';
    }

    const cuts = strings(rule.before)
      .map((marker) => (marker ? text.indexOf(marker) : -1))
      .filter((index) => index > 0);

    if (cuts.length) text = text.slice(0, Math.min(...cuts));

    const suffix = strings(rule.removeSuffix).find((value) => value && text.endsWith(value));

    if (suffix) text = text.slice(0, -suffix.length);

    return clean(text).slice(0, maxLength);
  }

  /** Returns the first nonblank title of a rule list. */
  function title(rules: unknown): string {
    for (const rule of Array.isArray(rules) ? rules : []) {
      const text = rule && typeof rule === 'object' ? apply(rule as PageTextRule) : '';

      if (text) return text;
    }

    return '';
  }

  /** Matches one path pattern segment and returns the ID that it captures. */
  function capture(pattern: string, segment: string): string | null | false {
    if (pattern === ':id') return /^\d+$/.test(segment) ? segment : false;

    if (pattern === '*-:id') return /-(\d+)$/.exec(segment)?.[1] ?? false;

    if (pattern === ':id-*') return /^(\d+)-/.exec(segment)?.[1] ?? false;

    return pattern === segment ? null : false;
  }

  const references: PageReference[] = [];
  let referenceCategory: string | null = null;
  const segments = location.pathname.split('/').filter(Boolean);

  for (const rule of Array.isArray(site?.references) ? site.references : []) {
    const pattern = typeof rule.path === 'string' ? rule.path.split('/').filter(Boolean) : [];
    let id: string | null = null;
    let matched = pattern.length > 0 && pattern.length <= segments.length;

    pattern.forEach((part, index) => {
      const result = matched ? capture(part, segments[index]!) : false;

      if (result === false) matched = false;
      else if (result) id = result;
    });

    if (matched && id && typeof rule.namespace === 'string' && typeof rule.entity === 'string') {
      references.push({ namespace: rule.namespace, entity: rule.entity, id });
      referenceCategory ??= typeof rule.category === 'string' ? rule.category : null;
    }
  }

  let category: string | null = null;

  for (const rule of Array.isArray(site?.categories) ? site.categories : []) {
    const text = clean(read(rule));
    const starts = typeof rule.startsWith === 'string' && rule.startsWith;
    const contains = typeof rule.contains === 'string' && rule.contains;

    if ((starts && text.startsWith(starts)) || (contains && text.includes(contains))) {
      category = rule.category;
      break;
    }
  }

  category ??= referenceCategory ?? site?.category ?? null;
  const siteTitle = site ? title(site.title) : '';

  return {
    url: location.href,
    title: siteTitle || title(fallback),
    category: category && categories.includes(category) ? (category as Category) : null,
    references,
    ruleId: siteTitle && site ? site.id : null,
    searchOnly: site?.searchOnly === true,
  };
}
