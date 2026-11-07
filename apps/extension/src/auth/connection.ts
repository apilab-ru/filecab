/// <reference types="vite/client" />
import { browser } from 'wxt/browser';

export const API_ORIGIN = import.meta.env.WXT_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:3001';

/** Reports only public connection metadata and extension identity for troubleshooting. */
export interface AuthDebugContext {
  extensionId: string;
  extensionOrigin: string;
  redirectUrl: string;
  apiOrigin: string;
}

/** Describes the actual loaded extension without reading any stored credentials. */
export function debugContext(): AuthDebugContext {
  return {
    extensionId: browser.runtime.id,
    extensionOrigin: `chrome-extension://${browser.runtime.id}`,
    redirectUrl: browser.identity.getRedirectURL('filecab'),
    apiOrigin: new URL(API_ORIGIN).origin,
  };
}
