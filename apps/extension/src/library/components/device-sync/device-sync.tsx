import { useLocalStore } from '@filecab/library';
import { useEffect } from 'react';
import { LocalLibraryRepository } from '../../repository';
import type { DeviceSyncState } from './model-device-sync';
import { SyncControls } from '../sync-controls/sync-controls';

/** Keeps device replication and Settings status active without rendering a popup library page. */
export function DeviceSync() {
  const [{ state }, { state: setState }] = useLocalStore(() => ({
    state: null as DeviceSyncState | null,
  }));
  useEffect(() => {
    let active = true;
    let repository: LocalLibraryRepository | undefined;
    let unsubscribe: (() => void) | undefined;
    void LocalLibraryRepository.open()
      .then(async (opened) => {
        if (!active) {
          await opened.close();

          return;
        }

        repository = opened;
        unsubscribe = opened.observe(
          (snapshot) => {
            if (active) setState({ repository: opened, snapshot });
          },
          () => {
            if (active) setState(null);
          },
        );
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe?.();
      void repository?.close();
    };
  }, []);

  return (
    <div hidden>
      {state && <SyncControls repository={state.repository} snapshot={state.snapshot} />}
    </div>
  );
}
