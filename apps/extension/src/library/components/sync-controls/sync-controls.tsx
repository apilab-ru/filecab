import { useTranslation, useInterfacePreferences } from '@filecab/library';
import '../../styles/library-controls-shared.scss';
import './sync-controls.scss';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStore, useSyncSettings } from '@filecab/library';
import { ApiErrorCode, SyncErrorCode, type AccountInfo } from '@filecab/contracts';
import { browser } from 'wxt/browser';
import type { AuthReply } from '../../../auth/worker';
import { LOCAL_DATABASE_NAME, readCollection } from '../../database';
import {
  SYNC_MESSAGES,
  SYNC_PHASE_MESSAGES,
  type SyncControlsProps,
  type SyncStatusUpdate,
} from './model-sync-controls';
import type { SyncBinding, SyncIssue } from '../../models/sync-models';
import { startLibraryReplication } from '../../replication';
import type { SyncStatus } from '../../models/sync-status';
import { confirmLink, previewLink, reconcileReset, switchAccount } from '../../sync-session';
import type { LinkPreview } from '../../models/link-preview';
import { SYNC_RUN_LOCK } from '../../models/sync-run-lock';
import { SyncError } from '../../sync-transport';
import { Button, ConfirmDialog } from '@filecab/ui';

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
  const { setSyncSettings, syncPanel } = useSyncSettings();
  const database = repository.database;
  const [
    {
      account,
      binding,
      issues,
      preview,
      status,
      lastSuccess,
      busy,
      message,
      rejectionOpen,
      resolutionChoices,
    },
    {
      account: setAccount,
      binding: setBinding,
      issues: setIssues,
      preview: setPreview,
      status: setStatus,
      lastSuccess: setLastSuccess,
      busy: setBusy,
      message: setMessage,
      rejectionOpen: setRejectionOpen,
      resolutionChoices: setResolutionChoices,
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
    rejectionOpen: false,
    resolutionChoices: {} as Record<string, 'device' | 'server'>,
  }));
  const seenValidationIds = useRef(new Set<string>());
  const [switchFailed, setSwitchFailed] = useState(false);
  const [switchAttempt, setSwitchAttempt] = useState(0);
  const switching = !!account && !!binding && binding.ownerId !== account.ownerId;

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
    setSwitchFailed(false);

    if (!switching || !account) return;

    const controller = new AbortController();
    void switchAccount(database, account.ownerId, controller.signal).catch(() => {
      if (!controller.signal.aborted) setSwitchFailed(true);
    });

    return () => controller.abort();
  }, [database, switching, binding?.ownerId, account?.ownerId, switchAttempt]);

  useEffect(() => {
    if (!binding || binding.phase !== 'linked' || binding.ownerId !== account?.ownerId) return;

    const controller = new AbortController();
    const channel = new BroadcastChannel(REFRESH_CHANNEL);
    let release: () => void = () => {};
    let resync: (() => void) | undefined;
    let latest: SyncStatusUpdate | undefined;
    const accept = ({ status, lastSuccess }: SyncStatusUpdate) => {
      setStatus(status);
      setLastSuccess(lastSuccess);
    };
    channel.onmessage = ({ data }: MessageEvent<'refresh' | 'status' | SyncStatusUpdate>) => {
      if (data === 'refresh') {
        resync?.();

        return;
      }

      if (data === 'status') {
        if (latest) channel.postMessage(latest);

        return;
      }

      if (data?.ownerId === binding.ownerId && data.generation === binding.generation) accept(data);
    };
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    setStatus({ phase: 'syncing' });
    channel.postMessage('status');
    void navigator.locks
      .request(SYNC_RUN_LOCK, { signal: controller.signal }, async () => {
        if (controller.signal.aborted) return;

        const state = startLibraryReplication(database, binding, (value) => {
          if (controller.signal.aborted) return;

          latest = {
            ownerId: binding.ownerId,
            generation: binding.generation,
            status: value,
            lastSuccess: value.phase === 'idle' ? Date.now() : (latest?.lastSuccess ?? null),
          };
          accept(latest);
          channel.postMessage(latest);
        });
        resync = () => state.reSync();
        window.addEventListener('online', resync);
        const timer = setInterval(resync, 30000);
        await held;
        clearInterval(timer);
        window.removeEventListener('online', resync);
        await state.cancel();
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus({ phase: 'failed', error: SyncErrorCode.RequestFailed });
      });

    return () => {
      controller.abort();
      channel.close();
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
  const visibleIssues = switching
    ? []
    : issues.filter((issue) => issue.ownerId === binding?.ownerId);
  const validationIssues = visibleIssues.filter((issue) => issue.kind === 'validation');
  const rejectedEntry = status.diagnostic?.entryId
    ? snapshot.rows.find((row) => row.entryId === status.diagnostic?.entryId)?.entry
    : undefined;

  const validationKey = validationIssues.map((issue) => issue.id).join();

  useEffect(() => {
    if (status.phase === 'failed' && status.error === ApiErrorCode.ValidationError)
      setRejectionOpen(true);
  }, [status.phase, status.error, status.diagnostic?.entryId]);

  // Push succeeds when the server rejects only some rows, so open the dialog for each
  // newly retained rejection; "Decide later" keeps it closed until another one appears.
  useEffect(() => {
    const added = validationIssues.some((issue) => !seenValidationIds.current.has(issue.id));
    seenValidationIds.current = new Set(validationIssues.map((issue) => issue.id));

    if (added) setRejectionOpen(true);
  }, [validationKey]);

  useEffect(() => {
    let descriptionText = t(synchronizationMessage(binding, own, status), {
      defaultValue: synchronizationMessage(binding, own, status),
    });

    // A linked device keeps its specific paused message; only an unlinked device needs a next step.
    if (!binding) descriptionText = account ? t('syncLinkFirst') : t('syncSignIn');

    if (switching) descriptionText = t(switchFailed ? 'syncSwitchFailed' : 'syncSwitching');

    setSyncSettings({
      enabled: !!account && own && binding?.phase === 'linked',
      working: busy || (switching && !switchFailed),
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
    switching,
    switchFailed,
    busy,
    lastSuccess,
    locale,
    t,
  ]);

  const section = (
    <section className="library-sync" aria-label={t('Account synchronization')}>
      {switching && switchFailed && (
        <Button type="button" onClick={() => setSwitchAttempt((attempt) => attempt + 1)}>
          {t('retryAccountDownload')}
        </Button>
      )}
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

  return (
    <>
      {syncPanel && createPortal(section, syncPanel)}
      <ConfirmDialog
        open={rejectionOpen}
        onOpenChange={setRejectionOpen}
        title={t('Resolve synchronization items')}
        description={t(
          'Choose which version to keep for each rejected item. You can apply one choice to all items.',
        )}
      >
        {validationIssues.length > 0 && (
          <div className="library-sync__rejection">
            <div className="library-sync__bulk-choice">
              <Button
                onClick={() =>
                  setResolutionChoices(
                    Object.fromEntries(validationIssues.map((issue) => [issue.id, 'device'])),
                  )
                }
              >
                {t('Use device data for all')}
              </Button>
              <Button
                onClick={() =>
                  setResolutionChoices(
                    Object.fromEntries(validationIssues.map((issue) => [issue.id, 'server'])),
                  )
                }
              >
                {t('Keep server data for all')}
              </Button>
            </div>
            {validationIssues.map((issue) => {
              const serverCopy = issue.conflict.serverDocument;

              return (
                <fieldset className="library-sync__resolution" key={issue.id}>
                  <legend>{issue.proposed.userTitle || t('Untitled')}</legend>
                  {issue.problem && (
                    <p className="library-sync__problem">
                      {issue.problem.path.join('.')}: {issue.problem.message}
                    </p>
                  )}
                  <label className="library-sync__choice">
                    <input
                      type="radio"
                      name={`resolve-${issue.id}`}
                      checked={resolutionChoices[issue.id] === 'device'}
                      onChange={() =>
                        setResolutionChoices((current) => ({ ...current, [issue.id]: 'device' }))
                      }
                    />
                    <span>{t('Use this device copy')}</span>
                  </label>
                  <label className="library-sync__choice">
                    <input
                      type="radio"
                      name={`resolve-${issue.id}`}
                      checked={resolutionChoices[issue.id] === 'server'}
                      onChange={() =>
                        setResolutionChoices((current) => ({ ...current, [issue.id]: 'server' }))
                      }
                    />
                    <span>
                      {serverCopy
                        ? t('Keep the server copy')
                        : t('Remove from this device; no server copy exists')}
                    </span>
                  </label>
                </fieldset>
              );
            })}
          </div>
        )}
        {validationIssues.length === 0 && rejectedEntry && (
          <div className="library-sync__rejection">
            <strong>{rejectedEntry.userTitle || t('Untitled')}</strong>
            <p>{t('Validation details are unavailable. Retry to identify the rejected item.')}</p>
          </div>
        )}
        {validationIssues.length === 0 && !rejectedEntry && (
          <p>{t('Validation details are unavailable. Retry to identify the rejected item.')}</p>
        )}
        <Button
          disabled={
            validationIssues.length === 0 ||
            validationIssues.some((issue) => !resolutionChoices[issue.id]) ||
            busy
          }
          onClick={() => {
            void run(async () => {
              for (const issue of validationIssues) {
                const current = snapshot.rows.find((row) => row.entryId === issue.proposed.entryId);
                await repository.resolveValidationIssue(
                  issue.id,
                  issue.ownerId,
                  current?.localRevision ?? null,
                  resolutionChoices[issue.id]!,
                );
              }
              setRejectionOpen(false);
              setResolutionChoices({});
              requestSyncRefresh();
            });
          }}
        >
          {t('Complete resolution and sync')}
        </Button>
        {validationIssues.length === 0 && (
          <Button
            onClick={() => {
              setRejectionOpen(false);
              requestSyncRefresh();
            }}
          >
            {t('Retry synchronization')}
          </Button>
        )}
        <Button disabled={busy} onClick={() => setRejectionOpen(false)}>
          {t('Decide later')}
        </Button>
      </ConfirmDialog>
    </>
  );
}
