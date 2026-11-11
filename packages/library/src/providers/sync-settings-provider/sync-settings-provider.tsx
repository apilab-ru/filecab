import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { SyncSettingsContext } from '../../models/sync-settings-context';
import type { SyncSettings } from '../../models/sync-settings';

const STORAGE_KEY = 'filecab-sync-settings';

/** Restores status without reviving a stale working state or unavailable refresh action. */
function readSyncSettings(): SyncSettings | null {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Omit<
      SyncSettings,
      'refresh'
    > | null;

    if (!stored) return null;

    return { ...stored, enabled: false, working: false, refresh: () => undefined };
  } catch {
    return null;
  }
}

/** Persists synchronization status while retaining refresh actions only in memory. */
export function SyncSettingsProvider({ children }: PropsWithChildren) {
  const [syncSettings, updateSettings] = useState(readSyncSettings);
  const setSyncSettings = useCallback((settings: SyncSettings | null) => {
    updateSettings(settings);
    try {
      if (settings) {
        // JSON serialization omits the refresh callback.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Live controls remain usable when browser storage is unavailable.
    }
  }, []);
  const value = useMemo(() => ({ syncSettings, setSyncSettings }), [syncSettings, setSyncSettings]);

  return <SyncSettingsContext.Provider value={value}>{children}</SyncSettingsContext.Provider>;
}
