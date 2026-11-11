import { useContext } from 'react';
import { SyncSettingsContext } from '../models/sync-settings-context';

/** Reads and updates synchronization settings in the current application shell. */
export function useSyncSettings() {
  const settings = useContext(SyncSettingsContext);

  if (!settings) throw new Error('SyncSettingsProvider is required.');

  return settings;
}
