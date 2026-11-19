import { createContext } from 'react';
import type { SyncSettings } from './sync-settings';

/** Shares persisted synchronization status and the active adapter's update action. */
export interface SyncSettingsContextValue {
  syncSettings: SyncSettings | null;
  setSyncSettings: (settings: SyncSettings | null) => void;
  /** The Settings element where a client adapter renders its own synchronization controls. */
  syncPanel: HTMLElement | null;
  setSyncPanel: (element: HTMLElement | null) => void;
}

export const SyncSettingsContext = createContext<SyncSettingsContextValue | null>(null);
