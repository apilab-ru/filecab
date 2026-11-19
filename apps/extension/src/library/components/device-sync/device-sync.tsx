import { useLocalStore } from '@filecab/library';
import { useWorkspace } from '@filecab/library';
import { localWorkspaceRepository } from '../../workspace-repository';
import { useEffect, useMemo } from 'react';
import { LocalLibraryRepository } from '../../repository';
import type { DeviceSyncState } from './model-device-sync';
import { SyncControls } from '../sync-controls/sync-controls';

/** Keeps popup replication and Settings status active without rendering a library page. */
export function DeviceSync() {
  const workspace = useWorkspace();
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

  const adapter = useMemo(
    () => (state ? localWorkspaceRepository(state.repository) : null),
    [state?.repository],
  );
  useEffect(() => {
    workspace.register({
      scope: 'device',
      rows:
        state?.snapshot.rows
          .filter((row) => !row.entry.deleted)
          .map((row) => ({ entry: row.entry, version: String(row.localRevision) })) ?? [],
      repository: adapter,
    });
  }, [state, adapter, workspace.register]);

  return (
    <div hidden>
      {state && <SyncControls repository={state.repository} snapshot={state.snapshot} />}
    </div>
  );
}
