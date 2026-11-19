import { useTranslation } from '@filecab/library';
import '../../styles/library-controls-shared.scss';
import './local-library.scss';

import { useLocalStore } from '@filecab/library';
import { LibraryBrowser } from '@filecab/library';
import type { LibraryContentProps } from '@filecab/library';
import { useWorkspace } from '@filecab/library';
import { localWorkspaceRepository } from '../../workspace-repository';
import { useEffect, useMemo } from 'react';
import { LocalLibraryRepository } from '../../repository';
import type { LocalSnapshot } from '../../models/local-snapshot';
import { exportRawLibrary } from '../../recovery';
import { downloadJsonFile } from './download-json-file';
import { SyncControls } from '../sync-controls/sync-controls';

/** Keeps the same durable device library and editor visible across authentication changes. */
export function LocalLibrary({ category }: LibraryContentProps) {
  const { t } = useTranslation();
  const workspace = useWorkspace();
  const [
    { attempt, repository, snapshot, failed, message },
    {
      attempt: setAttempt,
      repository: setRepository,
      snapshot: setSnapshot,
      failed: setFailed,
      message: setMessage,
    },
  ] = useLocalStore(() => ({
    attempt: 0,
    repository: null as LocalLibraryRepository | null,
    snapshot: null as LocalSnapshot | null,
    failed: false,
    message: '',
  }));

  useEffect(() => {
    let active = true;
    let opened: LocalLibraryRepository | undefined;
    let unsubscribe: (() => void) | undefined;

    setRepository(null);
    setSnapshot(null);
    setFailed(false);
    setMessage('');

    void LocalLibraryRepository.open()
      .then(async (local) => {
        if (!active) {
          await local.close();

          return;
        }

        opened = local;
        setRepository(local);
        unsubscribe = local.observe(
          (value) => {
            setSnapshot(value);
          },
          () => {
            setFailed(true);
            setSnapshot(null);
          },
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      unsubscribe?.();
      void opened?.close();
    };
  }, [attempt]);

  const adapter = useMemo(
    () => (repository ? localWorkspaceRepository(repository) : null),
    [repository],
  );
  useEffect(() => {
    workspace.register({
      scope: 'device',
      rows:
        snapshot?.rows
          .filter((row) => !row.entry.deleted)
          .map((row) => ({ entry: row.entry, version: String(row.localRevision) })) ?? [],
      repository: failed ? null : adapter,
    });
  }, [snapshot, adapter, failed, workspace.register]);

  const exportLibraryToFile = async () => {
    try {
      const data = await exportRawLibrary();
      downloadJsonFile(data, 'filecab-local-recovery.json');
    } catch {
      setMessage('Raw data could not be read. Storage has not been changed.');
    }
  };

  return (
    <section className="local-library" aria-label={t('Local library')}>
      {failed && (
        <div className="local-library__recovery" role="alert">
          <p className="local-library__error">
            {t('Local data could not be read. Existing storage has been preserved.')}
          </p>
          <button
            className="local-library__button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('Retry local storage')}
          </button>
          <button className="local-library__button" onClick={() => exportLibraryToFile()}>
            {t('Export recoverable raw data')}
          </button>
        </div>
      )}
      {!failed && (!snapshot || !repository) && (
        <p className="local-library__message">{t('Loading local data…')}</p>
      )}
      {!failed && snapshot && repository && (
        <>
          <div className="local-library__browser">
            <LibraryBrowser category={category} key={category} />
          </div>
          {/* Replication runs here; its visible section renders in the Settings sync card. */}
          <SyncControls repository={repository} snapshot={snapshot} />
        </>
      )}
      {message && (
        <p className="local-library__message" role="status">
          {t(message, { defaultValue: message })}
        </p>
      )}
    </section>
  );
}
