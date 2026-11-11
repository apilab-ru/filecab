import type { ReactNode } from 'react';
import type { PreferenceStorage } from '../../models/interface-preferences';

/** Supplies platform storage and content for one shared interface preference state. */
export interface InterfacePreferencesProviderProps {
  storage: PreferenceStorage;
  children: ReactNode;
}
