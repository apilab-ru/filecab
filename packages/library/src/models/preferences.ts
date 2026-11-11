import type { InterfacePreferences, PreferenceStorage } from './interface-preferences';

export { Theme } from './theme';
export { LibraryMode } from './library-mode';

export type { InterfacePreferences, PreferenceStorage } from './interface-preferences';

const STORAGE_KEY = 'filecab-interface';

/** Reads the website's non-sensitive preference record, falling back after unavailable storage. */
function readWebsitePreferences(): InterfacePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as InterfacePreferences;

    return { locale: value.locale, theme: value.theme };
  } catch {
    return {};
  }
}

export const websitePreferences: PreferenceStorage = {
  read: async () => readWebsitePreferences(),
  write: async (patch) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readWebsitePreferences(), ...patch }));
  },
  subscribe: (changed) => {
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) changed(readWebsitePreferences());
    };
    window.addEventListener('storage', listener);

    return () => window.removeEventListener('storage', listener);
  },
};
