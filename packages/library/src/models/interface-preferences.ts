import { createContext } from 'react';
import type { Locale } from '@filecab/contracts';
import type { Theme } from './theme';

/** Stores only device interface choices, independently of account library data. */
export interface InterfacePreferences {
  locale?: Locale;
  theme?: Theme;
}

/** Allows clients to supply their own durable preference storage and notifications. */
export interface PreferenceStorage {
  read: () => Promise<InterfacePreferences>;
  write: (patch: InterfacePreferences) => Promise<void>;
  subscribe: (changed: (value: InterfacePreferences) => void) => () => void;
}

/** Shares resolved preferences and update actions within one application shell. */
export interface InterfacePreferenceState {
  locale: Locale;
  theme: Theme;
  setLocale: (locale: Locale | string) => void;
  setTheme: (theme: Theme | string) => void;
}

export const InterfacePreferencesContext = createContext<InterfacePreferenceState | null>(null);
