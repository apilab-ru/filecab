import { useEffect, useState, type FormEvent } from 'react';
import { Category, Status, type EntryPatch } from '@filecab/contracts';
import { type LocalEntry } from './database';
import { LocalLibraryError, LocalLibraryRepository, type LocalSnapshot } from './repository';
import { exportRawLibrary } from './recovery';
import { SyncControls } from './sync-controls';

const FAILURE_MESSAGES = {
  CONFLICT:
    'This entry changed or its sources are already in use. Reload the entry before saving again.',
  NOT_FOUND: 'This entry is no longer available. Reload the library.',
  INVALID_ENTRY: 'A manual title and unique HTTP(S) sources are required.',
  UNDO_EXPIRED: 'The 10-second Undo period has expired.',
  STORAGE_UNAVAILABLE: 'Local storage is unavailable. Your existing data has been preserved.',
};

/** Edits one local document while keeping unsaved input after a failed or stale save. */
function EntryEditor({
  row,
  save,
  cancel,
  reload,
}: {
  row: LocalEntry | null;
  save: (category: Category, fields: EntryPatch) => Promise<void>;
  cancel: () => void;
  reload?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await save(data.get('category') as Category, {
        userTitle: String(data.get('title')),
        category: data.get('category') as Category,
        status: (data.get('status') || null) as Status | null,
        rating: Number(data.get('rating')),
        progress: Number(data.get('progress')),
        comment: String(data.get('comment')),
        sourceUrls: String(data.get('sources'))
          .split('\n')
          .filter((url) => url !== ''),
      });
    } catch (failure) {
      setError(
        failure instanceof LocalLibraryError
          ? FAILURE_MESSAGES[failure.code]
          : 'Save failed. Your input is still here; retry or reload the entry.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="local-editor"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label className="local-editor__field">
        Title
        <input
          className="local-editor__input"
          name="title"
          required
          maxLength={10000}
          defaultValue={row?.entry.userTitle ?? ''}
        />
      </label>
      <label className="local-editor__field">
        Category
        <select
          className="local-editor__input"
          name="category"
          defaultValue={row?.entry.category ?? Category.Anime}
        >
          {Object.values(Category).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="local-editor__field">
        Status
        <select
          className="local-editor__input"
          name="status"
          defaultValue={row?.entry.status ?? ''}
        >
          <option value="">No status</option>
          {Object.values(Status).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="local-editor__field">
        Rating
        <input
          className="local-editor__input"
          name="rating"
          type="number"
          min={0}
          max={10}
          step={1}
          defaultValue={row?.entry.rating ?? 0}
        />
      </label>
      <label className="local-editor__field">
        Progress
        <input
          className="local-editor__input"
          name="progress"
          type="number"
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          defaultValue={row?.entry.progress ?? 0}
        />
      </label>
      <label className="local-editor__field">
        Comment
        <textarea
          className="local-editor__input"
          name="comment"
          maxLength={100000}
          defaultValue={row?.entry.comment ?? ''}
        />
      </label>
      <label className="local-editor__field">
        Viewing URLs (one per line)
        <textarea
          className="local-editor__input"
          name="sources"
          defaultValue={row?.entry.sources.map((source) => source.originalUrl).join('\n') ?? ''}
        />
      </label>
      {error && (
        <p className="local-library__error" role="alert">
          {error}
        </p>
      )}
      {error && reload && (
        <button
          className="local-library__button"
          type="button"
          onClick={() => {
            void reload().catch(() =>
              setError('The current entry could not be loaded. Your input is still here.'),
            );
          }}
        >
          Reload entry
        </button>
      )}
      <div className="local-library__actions">
        <button className="local-library__button" disabled={busy}>
          Save locally
        </button>
        <button className="local-library__button" type="button" onClick={cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Keeps the same durable device library and editor visible across authentication changes. */
export function LocalLibrary({ name }: { name: string }) {
  const [attempt, setAttempt] = useState(0);
  const [repository, setRepository] = useState<LocalLibraryRepository | null>(null);
  const [snapshot, setSnapshot] = useState<LocalSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<LocalEntry | null | undefined>(undefined);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    let opened: LocalLibraryRepository | undefined;
    let unsubscribe: (() => void) | undefined;
    setRepository(null);
    setSnapshot(null);
    setEditing(undefined);
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
  const recover = async () => {
    try {
      const data = await exportRawLibrary();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'filecab-local-recovery.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage('Raw data could not be read. Storage has not been changed.');
    }
  };
  const scopeLabel = 'Library on this device';

  return (
    <section className="local-library" aria-label="Local library">
      <h1 className="local-library__title">{name}</h1>
      <p className="local-library__scope">{scopeLabel}</p>
      {failed && (
        <div className="local-library__recovery" role="alert">
          <p className="local-library__error">
            Local data could not be read. Existing storage has been preserved.
          </p>
          <button
            className="local-library__button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry local storage
          </button>
          <button
            className="local-library__button"
            onClick={() => {
              void recover();
            }}
          >
            Export recoverable raw data
          </button>
        </div>
      )}
      {!failed && (!snapshot || !repository) && (
        <p className="local-library__message">Loading local data…</p>
      )}
      {!failed && snapshot && repository && (
        <>
          <p className="local-library__message">Saved locally · revision {snapshot.revision}.</p>
          <SyncControls repository={repository} snapshot={snapshot} />
          {editing !== undefined ? (
            <EntryEditor
              key={`${editing?.entryId ?? 'new'}:${editing?.localRevision ?? 0}`}
              row={editing}
              cancel={() => setEditing(undefined)}
              reload={
                editing
                  ? async () => {
                      const fresh = (await repository.snapshot()).rows.find(
                        (row) => row.entryId === editing.entryId && !row.entry.deleted,
                      );

                      if (!fresh) throw new LocalLibraryError('NOT_FOUND');

                      setEditing(fresh);
                    }
                  : undefined
              }
              save={async (category, fields) => {
                if (editing)
                  await repository.update(editing.entryId, editing.localRevision, fields);
                else await repository.create(category, fields);

                setEditing(undefined);
                setMessage('Saved on this device.');
              }}
            />
          ) : (
            <button className="local-library__button" onClick={() => setEditing(null)}>
              Add manual entry
            </button>
          )}
          <ul className="local-library__entries">
            {snapshot.rows
              .filter((row) => !row.entry.deleted)
              .map((row) => (
                <li className="local-library__entry" key={row.entryId}>
                  <span className="local-library__entry-title">
                    {row.entry.userTitle || row.entry.snapshot.originalTitle?.text || 'Untitled'}
                  </span>
                  <span className="local-library__entry-details">
                    {row.entry.category} · {row.entry.status ?? 'No status'} · Progress{' '}
                    {row.entry.progress}
                  </span>
                  <div className="local-library__actions">
                    <button className="local-library__button" onClick={() => setEditing(row)}>
                      Edit
                    </button>
                    <button
                      className="local-library__button"
                      onClick={() => {
                        void run(() => repository.delete(row.entryId, row.localRevision));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
          {snapshot.rows
            .filter((row) => row.entry.deleted && row.undoUntil && row.undoUntil > now)
            .map((row) => (
              <div className="local-library__undo" key={row.entryId}>
                <span>Deleted {row.undoBefore?.userTitle}</span>
                <button
                  className="local-library__button"
                  onClick={() => {
                    void run(() => repository.undo(row.entryId, row.localRevision));
                  }}
                >
                  Undo
                </button>
              </div>
            ))}
        </>
      )}
      {message && (
        <p className="local-library__message" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
