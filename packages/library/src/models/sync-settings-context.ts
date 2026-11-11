import { createContext } from 'react';
import type { SyncSettings } from './sync-settings';

/** Shares persisted synchronization status and the active adapter's update action. */
export interface SyncSettingsContextValue {
  syncSettings: SyncSettings | null;
  setSyncSettings: (settings: SyncSettings | null) => void;
}

export const SyncSettingsContext = createContext<SyncSettingsContextValue | null>(null);
