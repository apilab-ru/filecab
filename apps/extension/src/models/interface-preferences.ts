import { browser } from 'wxt/browser';
import type { InterfacePreferences, PreferenceStorage } from '@filecab/library';

const STORAGE_KEY = 'filecab-interface';

export const extensionPreferences: PreferenceStorage = {
  read: async () => {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const value = data[STORAGE_KEY] as InterfacePreferences | undefined;

    return { locale: value?.locale, theme: value?.theme };
  },
  write: async (patch) => {
    await navigator.locks.request(`${STORAGE_KEY}:write`, async () => {
      const data = await browser.storage.local.get(STORAGE_KEY);
      await browser.storage.local.set({
        [STORAGE_KEY]: {
          locale: patch.locale ?? (data[STORAGE_KEY] as InterfacePreferences | undefined)?.locale,
          theme: patch.theme ?? (data[STORAGE_KEY] as InterfacePreferences | undefined)?.theme,
        },
      });
    });
  },
  subscribe: (changed) => {
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        const value = changes[STORAGE_KEY].newValue as InterfacePreferences | undefined;

        changed({ locale: value?.locale, theme: value?.theme });
      }
    };
    browser.storage.onChanged.addListener(listener);

    return () => browser.storage.onChanged.removeListener(listener);
  },
};
