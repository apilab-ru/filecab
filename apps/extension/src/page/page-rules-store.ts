import { PAGE_RULES, type PageRulesConfig } from '@filecab/contracts';
import { browser } from 'wxt/browser';
import { API_ORIGIN } from '../auth/connection';

/** The rule engine version of this extension build. */
export const ENGINE_VERSION = 1;

const STORAGE_KEY = 'pageRules';

const FETCH_TIMEOUT_MS = 3000;

/** Keeps the last valid served configuration with its cache validator. */
interface StoredPageRules {
  config: PageRulesConfig;
  etag: string;
}

/** Checks the version fields that decide whether this engine can run a configuration. */
function compatible(config: unknown): config is PageRulesConfig {
  if (!config || typeof config !== 'object') return false;

  const value = config as Partial<PageRulesConfig>;

  return (
    value.schemaVersion === 1 &&
    Number.isSafeInteger(value.revision) &&
    Number.isSafeInteger(value.engineVersion) &&
    value.engineVersion! <= ENGINE_VERSION &&
    Array.isArray(value.sites) &&
    Array.isArray(value.fallback) &&
    Array.isArray(value.excludedHosts)
  );
}

/** Reads the last valid served configuration, if the device has one. */
async function storedRules(): Promise<StoredPageRules | undefined> {
  try {
    const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as
      StoredPageRules | undefined;

    return stored && compatible(stored.config) ? stored : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the served configuration when the engine supports it. Without a usable answer, it
 * returns the newer of the last valid configuration and the bundled default.
 */
export async function loadPageRules(): Promise<PageRulesConfig> {
  const known = await storedRules();

  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/page-rules`, {
      headers: known ? { 'If-None-Match': known.etag } : {},
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (response.status === 304 && known) return known.config;

    const config: unknown = response.ok ? await response.json() : null;
    const etag = response.headers.get('ETag');

    if (compatible(config)) {
      if (etag)
        await browser.storage.local.set({ [STORAGE_KEY]: { config, etag } }).catch(() => {});

      return config;
    }
  } catch {
    // An offline or failed request uses the last valid or the bundled configuration.
  }

  return known && known.config.revision >= PAGE_RULES.revision ? known.config : PAGE_RULES;
}
