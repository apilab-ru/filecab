import { useTranslation } from '@filecab/library';
import '../../styles/library-controls-shared.scss';
import './local-library.scss';

import { useLocalStore } from '@filecab/library';
import { LibraryBrowser } from '@filecab/library';
import type { LibraryContentProps } from '@filecab/library';
import { useWorkspace } from '@filecab/library';
import { localWorkspaceRepository } from '../../workspace-repository';
import { useEffect, useMemo } from 'react';
import { FAILURE_MESSAGES } from '../../models/failure-messages';
import { LocalLibraryError, LocalLibraryRepository } from '../../repository';
import type { LocalSnapshot } from '../../models/local-snapshot';
import { exportRawLibrary } from '../../recovery';
import { downloadJsonFile } from './download-json-file';

/** Keeps the same durable device library and editor visible across authentication changes. */
export function LocalLibrary({ category }: LibraryContentProps) {
  const { t } = useTranslation();
  const workspace = useWorkspace();
  const [
    { attempt, repository, snapshot, failed, message, now },
    {
      attempt: setAttempt,
      repository: setRepository,
      snapshot: setSnapshot,
      failed: setFailed,
      message: setMessage,
      now: setNow,
    },
  ] = useLocalStore(() => ({
    attempt: 0,
    repository: null as LocalLibraryRepository | null,
    snapshot: null as LocalSnapshot | null,
    failed: false,
    message: '',
    now: Date.now(),
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(timer);
  }, []);

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

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setMessage('Saved on this device.');
    } catch (error) {
      setMessage(
        error instanceof LocalLibraryError
          ? FAILURE_MESSAGES[error.code]
          : 'Local save failed. Existing data has been preserved.',
      );
    }
  };

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
            <LibraryBrowser
              category={category}
              key={category}
              entries={snapshot.rows.map((row) => row.entry)}
              onAdd={() => workspace.open(category)}
              onEdit={(entry) => {
                const row = snapshot.rows.find((row) => row.entryId === entry.entryId);

                if (row)
                  workspace.open(category, {
                    entry: row.entry,
                    version: String(row.localRevision),
                  });
              }}
              onDelete={(entry) => {
                const row = snapshot.rows.find((row) => row.entryId === entry.entryId);

                if (row) void run(() => repository.delete(row.entryId, row.localRevision));
              }}
            />
          </div>
          {snapshot.rows
            .filter((row) => row.entry.deleted && row.undoUntil && row.undoUntil > now)
            .map((row) => (
              <div className="local-library__undo" key={row.entryId}>
                <span>
                  {t('Deleted')} {row.undoBefore?.userTitle}
                </span>
                <button
                  className="local-library__button"
                  onClick={() => {
                    void run(() => repository.undo(row.entryId, row.localRevision));
                  }}
                >
                  {t('Undo')}
                </button>
              </div>
            ))}
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
