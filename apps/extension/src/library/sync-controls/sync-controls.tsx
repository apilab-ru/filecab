import { useTranslation, useInterfacePreferences } from '@filecab/library';
import '../styles/library-controls-shared.scss';
import './sync-controls.scss';

import { useEffect } from 'react';
import { useLocalStore, useSyncSettings } from '@filecab/library';
import { ApiErrorCode, SyncErrorCode, type AccountInfo } from '@filecab/contracts';
import { browser } from 'wxt/browser';
import type { AuthReply } from '../../auth/worker';
import { LOCAL_DATABASE_NAME, readCollection } from '../database';
import type { LocalLibraryRepository } from '../repository';
import type { LocalSnapshot } from '../models/local-snapshot';
import { SYNC_MESSAGES, SYNC_PHASE_MESSAGES, type SyncControlsProps } from './model-sync-controls';
import type { SyncBinding, SyncIssue } from '../models/sync-models';
import { startLibraryReplication } from '../replication';
import type { SyncStatus } from '../models/sync-status';
import { confirmLink, previewLink, reconcileReset } from '../sync-session';
import type { LinkPreview } from '../models/link-preview';
import { SYNC_RUN_LOCK } from '../models/sync-run-lock';
import { SyncError } from '../sync-transport';

const REFRESH_CHANNEL = `${LOCAL_DATABASE_NAME}:sync-refresh`;

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

/** Asks the active replication surface to retry without opening another replication session. */
function requestSyncRefresh() {
  const channel = new BroadcastChannel(REFRESH_CHANNEL);
  channel.postMessage('refresh');
  channel.close();
}

/** Shows explicit linking, network state and durable recovery without remounting the editor. */
export function SyncControls({ repository, snapshot }: SyncControlsProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { setSyncSettings } = useSyncSettings();
  const database = repository.database;
  const [
    { account, binding, issues, preview, status, lastSuccess, busy, message },
    {
      account: setAccount,
      binding: setBinding,
      issues: setIssues,
      preview: setPreview,
      status: setStatus,
      lastSuccess: setLastSuccess,
      busy: setBusy,
      message: setMessage,
    },
  ] = useLocalStore(() => ({
    account: null as AccountInfo | null,
    binding: null as SyncBinding | null,
    issues: [] as SyncIssue[],
    preview: null as LinkPreview | null,
    status: { phase: 'idle' } as SyncStatus,
    lastSuccess: null as number | null,
    busy: false,
    message: '',
  }));

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
    setLastSuccess(null);
  }, [account?.ownerId, binding?.generation]);
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
          if (!stopped) {
            setStatus(value);

            if (value.phase === 'idle') setLastSuccess(Date.now());
          }
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
  const own = binding?.ownerId === account?.ownerId;
  const visibleIssues = issues.filter((issue) => issue.ownerId === binding?.ownerId);

  useEffect(() => {
    let descriptionText = t(synchronizationMessage(binding, own, status), {
      defaultValue: synchronizationMessage(binding, own, status),
    });

    if (!account) descriptionText = t('syncSignIn');
    else if (!binding) descriptionText = t('syncLinkFirst');

    setSyncSettings({
      enabled: !!account && own && binding?.phase === 'linked',
      working: busy,
      online: false,
      message: descriptionText,
      lastSuccess: own ? lastSuccess : null,
      refresh: requestSyncRefresh,
    });

    return () => setSyncSettings(null);
  }, [
    setSyncSettings,
    account?.ownerId,
    binding?.ownerId,
    binding?.phase,
    status.phase,
    status.error,
    own,
    busy,
    lastSuccess,
    locale,
    t,
  ]);

  return (
    <section className="library-sync" aria-label={t('Account synchronization')}>
      <p className="local-library__message" role="status">
        {t(synchronizationMessage(binding, own, status), {
          defaultValue: synchronizationMessage(binding, own, status),
        })}
      </p>
      {binding && own && status.phase === 'failed' && status.diagnostic && (
        <p className="library-sync__diagnostic">
          {t('Code:')} {status.diagnostic.code}
          {status.diagnostic.operation && ` · ${t('Operation')}: ${status.diagnostic.operation}`}
          {status.diagnostic.status && ` · HTTP ${status.diagnostic.status}`}
          {status.diagnostic.correlationId &&
            ` · ${t('Request')} ${status.diagnostic.correlationId}`}
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
          {t('Preview account link')}
        </button>
      )}
      {preview && account?.ownerId === preview.ownerId && (
        <div className="library-sync__preview">
          <p className="local-library__message">
            {t('linkSummary', {
              local: t('titleCount', { count: preview.localCount }),
              remote: t('titleCount', { count: preview.remoteCount }),
              conflicts: preview.conflicts,
            })}{' '}
            {t(
              'Server versions win conflicts; rejected local edits remain available for review. Confirming authorizes uploading device entries and downloading account entries.',
            )}
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
            {t('Confirm link and synchronize')}
          </button>
          <button
            className="local-library__button"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            {t('Cancel link')}
          </button>
        </div>
      )}
      {binding && own && binding.phase === 'linked' && (
        <button className="local-library__button" onClick={requestSyncRefresh}>
          {t('Refresh account library')}
        </button>
      )}
      {binding && own && binding.phase !== 'linked' && (
        <div className="library-sync__recovery">
          <p className="local-library__message">
            {t(
              'Recovery saves all current device entries for review, then loads the current account library. Entries absent from the server remain deleted until you deliberately reapply them.',
            )}
          </p>
          <button
            className="local-library__button"
            disabled={busy}
            onClick={() => {
              void run(() => reconcileReset(database, binding.ownerId));
            }}
          >
            {t('Preserve local intent and recover')}
          </button>
        </div>
      )}
      {visibleIssues.length > 0 && (
        <p className="local-library__message">
          {t('reviewCount', { count: visibleIssues.length })}
        </p>
      )}
      {visibleIssues.map((issue) => {
        const row = snapshot.rows.find((candidate) => candidate.entryId === issue.proposed.entryId);

        return (
          <details className="library-sync__issue" key={issue.id}>
            <summary className="library-sync__summary">
              {t(issue.kind === 'reset' ? 'Saved before history reset' : 'Rejected local edit')}:{' '}
              {issue.proposed.userTitle || t('Untitled')}
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
              {t('Reapply this saved edit')}
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
              {t('Dismiss saved edit')}
            </button>
          </details>
        );
      })}
      {message && (
        <p className="local-library__error" role="alert">
          {t(message, { defaultValue: message })}
        </p>
      )}
    </section>
  );
}
