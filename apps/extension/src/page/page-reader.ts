import { PageReadStatus, type PageReadResult } from '@filecab/library';
import type { PageExtraction } from '@filecab/contracts';
import { browser } from 'wxt/browser';
import { extractPage } from './extract-page';
import { loadPageRules } from './page-rules-store';

/** Returns the host name without a leading `www.`, or null for a URL that must not be read. */
function readableHost(address: string): string | null {
  try {
    const url = new URL(address);

    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;

    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Checks the shape of the data that the page returned. Page data is untrusted. */
function isExtraction(value: unknown): value is PageExtraction {
  const page = value as Partial<PageExtraction> | null;

  return Boolean(
    page &&
    typeof page.title === 'string' &&
    Array.isArray(page.references) &&
    page.references.every(
      (reference) =>
        typeof reference?.namespace === 'string' &&
        typeof reference.entity === 'string' &&
        /^\d+$/.test(reference.id),
    ),
  );
}

/**
 * Reads the active tab after the user opened the popup. The extension injects the bundled
 * engine only into this tab, through the `activeTab` grant. It reads no other tab and keeps
 * no page behavior after the read.
 */
export async function readActivePage(): Promise<PageReadResult> {
  const rules = await loadPageRules();
  let tab: { id?: number; url?: string } | undefined;

  try {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch {
    return { status: PageReadStatus.Failed };
  }

  const host = tab?.url ? readableHost(tab.url) : null;

  if (
    !tab?.id ||
    !tab.url ||
    !host ||
    rules.excludedHosts.some((excluded) => host === excluded || host.endsWith(`.${excluded}`))
  )
    return { status: PageReadStatus.Restricted };

  const site = rules.sites.find((rule) => rule.hosts.includes(host)) ?? null;

  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
      args: [site, rules.fallback],
    });
    const page: unknown = injection?.result;

    if (!isExtraction(page)) return { status: PageReadStatus.Failed };

    // The browser's tab URL is the link. The page cannot replace it.
    return { status: PageReadStatus.Page, page: { ...page, url: tab.url } };
  } catch {
    // Browser pages, the extension store and pages without the activeTab grant refuse scripts.
    return { status: PageReadStatus.Restricted };
  }
}
