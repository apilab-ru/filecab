import { ApiErrorCode, SyncErrorCode, type AccountInfo } from '@filecab/contracts';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { AuthReply } from '../auth/worker';
import { LOCAL_DATABASE_NAME, readCollection } from './database';
import type { LocalLibraryRepository, LocalSnapshot } from './repository';
import type { SyncBinding, SyncIssue } from './sync-models';
import { startLibraryReplication, type SyncStatus } from './replication';
import {
  confirmLink,
  previewLink,
  reconcileReset,
  SYNC_RUN_LOCK,
  type LinkPreview,
} from './sync-session';
import { SyncError } from './sync-transport';

const REFRESH_CHANNEL = `${LOCAL_DATABASE_NAME}:sync-refresh`;

const SYNC_MESSAGES: Partial<Record<ApiErrorCode | SyncErrorCode, string>> = {
  [SyncErrorCode.PreviewChanged]:
    'One of the libraries changed. Preview the link again before confirming.',
  [SyncErrorCode.AccountChanged]:
    'Synchronization is paused. Sign in to the account linked to this device library.',
  [ApiErrorCode.ValidationError]:
    'The server rejected a document. Your local data is preserved; retry after correcting it.',
  [SyncErrorCode.NetworkError]:
    'The API could not be reached. Check its address and connection; saved changes will be retried.',
  [SyncErrorCode.WorkerUnavailable]:
    'The extension worker did not reply. Reload the extension and reopen this page.',
  [ApiErrorCode.Forbidden]:
    'The API denied synchronization. Check this extension origin in EXTENSION_ORIGINS and restart the API.',
  [SyncErrorCode.ApiOutdated]:
    'The API has no replication route. Restart the API with the current implementation.',
  [ApiErrorCode.InvalidResponse]:
    'The API returned an unreadable response. Check the API address and server logs.',
  [ApiErrorCode.PayloadTooLarge]:
    'The synchronization batch exceeds the API body limit. Your saved changes are preserved.',
  [ApiErrorCode.RateLimited]:
    'The API is rate limiting synchronization. Saved changes will be retried.',
  [SyncErrorCode.ServerError]:
    'The API failed to synchronize. Use the request ID below to check its logs.',
  [ApiErrorCode.ServiceUnavailable]:
    'The API is unavailable. Check database readiness; saved changes will be retried.',
  [SyncErrorCode.ReplicationError]:
    'Local replication failed. Saved data is preserved; check the diagnostic code below.',
  [SyncErrorCode.RequestFailed]: 'Synchronization failed. Saved local changes will be retried.',
};

const SYNC_PHASE_MESSAGES = {
  idle: 'Account synchronization is up to date.',
  syncing: 'Synchronizing saved changes, or waiting for another open window…',
  'reset-required': 'Synchronizing saved changes, or waiting for another open window…',
};

/** Selects the status message in account and recovery priority order. */
function synchronizationMessage(
  binding: SyncBinding | null,
  own: boolean,
  status: SyncStatus,
): string {
  if (!binding) return 'Saved on this device. Link explicitly to synchronize with your account.';

  if (!own) return 'Synchronization paused: sign in to the account linked to this device library.';

  if (binding.phase !== 'linked') return 'Synchronization paused: history reset requires recovery.';

  if (status.phase === 'failed')
    return (
      SYNC_MESSAGES[status.error ?? SyncErrorCode.RequestFailed] ??
      SYNC_MESSAGES[SyncErrorCode.RequestFailed]!
    );

  return SYNC_PHASE_MESSAGES[status.phase];
}

/** Shows explicit linking, network state and durable recovery without remounting the editor. */
export function SyncControls({
  repository,
  snapshot,
}: {
  repository: LocalLibraryRepository;
  snapshot: LocalSnapshot;
}) {
  const database = repository.database;
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [binding, setBinding] = useState<SyncBinding | null>(null);
  const [issues, setIssues] = useState<SyncIssue[]>([]);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ phase: 'idle' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const reply = (await browser.runtime.sendMessage({ action: 'auth.status' })) as AuthReply;

        if (active) setAccount(reply?.account ?? null);
      } catch {
        if (active) setAccount(null);
      }
    };
    const changed = (message: unknown) => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'action' in message &&
        message.action === 'auth.changed'
      )
        void refresh();
    };
    browser.runtime.onMessage.addListener(changed);
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 30000);

    return () => {
      active = false;
      clearInterval(timer);
      browser.runtime.onMessage.removeListener(changed);
    };
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [bindings, saved] = await Promise.all([
          readCollection(database.binding),
          readCollection(database.issues),
        ]);

        if (active) {
          setBinding(bindings[0] ?? null);
          setIssues(saved);
        }
      } catch {
        if (active)
          setMessage('Synchronization storage could not be read. Existing data is preserved.');
      }
    };
    const subscriptions = [
      database.binding.find().$.subscribe(() => {
        void load();
      }),
      database.issues.find().$.subscribe(() => {
        void load();
      }),
    ];

    return () => {
      active = false;
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    };
  }, [database]);
  useEffect(() => {
    setPreview(null);
  }, [account?.ownerId]);
  useEffect(() => {
    if (!binding || binding.phase !== 'linked' || binding.ownerId !== account?.ownerId) return;

    const controller = new AbortController();
    let release: () => void = () => {};
    let stopped = false;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    setStatus({ phase: 'syncing' });
    void navigator.locks
      .request(SYNC_RUN_LOCK, { signal: controller.signal }, async () => {
        if (stopped) return;

        const state = startLibraryReplication(database, binding, (value) => {
          if (!stopped) setStatus(value);
        });
        const channel = new BroadcastChannel(REFRESH_CHANNEL);
        channel.onmessage = () => state.reSync();
        const resync = () => state.reSync();
        window.addEventListener('online', resync);
        const timer = setInterval(resync, 30000);
        await held;
        clearInterval(timer);
        window.removeEventListener('online', resync);
        channel.close();
        await state.cancel();
      })
      .catch(() => {
        if (!stopped) setStatus({ phase: 'failed', error: SyncErrorCode.RequestFailed });
      });

    return () => {
      stopped = true;
      controller.abort();
      release();
    };
  }, [database, binding?.ownerId, binding?.generation, binding?.phase, account?.ownerId]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof SyncError
          ? (SYNC_MESSAGES[error.code] ?? 'The operation failed. Your local data is preserved.')
          : 'The operation failed or the entry changed. Reload and review before trying again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => {
    const channel = new BroadcastChannel(REFRESH_CHANNEL);
    channel.postMessage('refresh');
    channel.close();
  };
  const own = binding?.ownerId === account?.ownerId;
  const visibleIssues = issues.filter((issue) => issue.ownerId === binding?.ownerId);

  return (
    <section className="library-sync" aria-label="Account synchronization">
      <p className="local-library__message" role="status">
        {synchronizationMessage(binding, own, status)}
      </p>
      {binding && own && status.phase === 'failed' && status.diagnostic && (
        <p className="auth-controls__diagnostic">
          Code: {status.diagnostic.code}
          {status.diagnostic.operation && ` · Operation: ${status.diagnostic.operation}`}
          {status.diagnostic.status && ` · HTTP ${status.diagnostic.status}`}
          {status.diagnostic.correlationId && ` · Request ${status.diagnostic.correlationId}`}
          {status.diagnostic.rxdbCode && ` · RxDB ${status.diagnostic.rxdbCode}`}
        </p>
      )}
      {!binding && account && !preview && (
        <button
          className="local-library__button"
          disabled={busy}
          onClick={() => {
            void run(async () => setPreview(await previewLink(database, account.ownerId)));
          }}
        >
          Preview account link
        </button>
      )}
      {preview && account?.ownerId === preview.ownerId && (
        <div className="library-sync__preview">
          <p className="local-library__message">
            Link {preview.localCount} active device entries with {preview.remoteCount} account
            entries. {preview.conflicts} device entries have overlapping identities or sources.
            Server versions win conflicts; rejected local edits remain available for review.
            Confirming authorizes uploading device entries and downloading account entries.
          </p>
          <button
            className="local-library__button"
            disabled={busy}
            onClick={() => {
              void run(async () => {
                await confirmLink(database, preview);
                setPreview(null);
              });
            }}
          >
            Confirm link and synchronize
          </button>
          <button
            className="local-library__button"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            Cancel link
          </button>
        </div>
      )}
      {binding && own && binding.phase === 'linked' && (
        <button className="local-library__button" onClick={refresh}>
          Refresh account library
        </button>
      )}
      {binding && own && binding.phase !== 'linked' && (
        <div className="library-sync__recovery">
          <p className="local-library__message">
            Recovery saves all current device entries for review, then loads the current account
            library. Entries absent from the server remain deleted until you deliberately reapply
            them.
          </p>
          <button
            className="local-library__button"
            disabled={busy}
            onClick={() => {
              void run(() => reconcileReset(database, binding.ownerId));
            }}
          >
            Preserve local intent and recover
          </button>
        </div>
      )}
      {visibleIssues.length > 0 && (
        <p className="local-library__message">{visibleIssues.length} saved edits need review.</p>
      )}
      {visibleIssues.map((issue) => {
        const row = snapshot.rows.find((candidate) => candidate.entryId === issue.proposed.entryId);

        return (
          <details className="library-sync__issue" key={issue.id}>
            <summary className="library-sync__summary">
              {issue.kind === 'reset' ? 'Saved before history reset' : 'Rejected local edit'}:{' '}
              {issue.proposed.userTitle || 'Untitled'}
            </summary>
            <pre className="library-sync__intent">
              {JSON.stringify(
                {
                  category: issue.proposed.category,
                  title: issue.proposed.userTitle,
                  status: issue.proposed.status,
                  progress: issue.proposed.progress,
                  rating: issue.proposed.rating,
                  notes: issue.proposed.comment,
                  sources: issue.proposed.sources.map((source) => source.originalUrl),
                  deleted: issue.proposed.deleted,
                },
                null,
                2,
              )}
            </pre>
            <button
              className="local-library__button"
              disabled={busy || !own || binding?.phase !== 'linked' || !row}
              onClick={() => {
                void run(async () => {
                  await repository.reapplyIssue(issue.id, issue.ownerId, row!.localRevision);
                });
              }}
            >
              Reapply this saved edit
            </button>
            <button
              className="local-library__button"
              disabled={busy || !own}
              onClick={() => {
                void run(async () => {
                  await database.issues.findOne(issue.id).remove();
                });
              }}
            >
              Dismiss saved edit
            </button>
          </details>
        );
      })}
      {message && (
        <p className="local-library__error" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
