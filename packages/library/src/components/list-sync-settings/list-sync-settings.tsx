import './list-sync-settings.scss';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog } from '@filecab/ui';
import {
  ListSyncErrorCode,
  ListSyncJobKind,
  ListSyncJobState,
  ListSyncState,
  type ListSyncField,
  type ListSyncImportPreview,
  type ListSyncJob,
  type ListSyncOutcome,
  type ListSyncOverview,
  type ListSyncProvider,
} from '@filecab/contracts';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { ListSyncRequestError } from '../../models/list-sync';
import { ListSyncPreview } from '../list-sync-preview/list-sync-preview';
import {
  ERROR_LABELS,
  ISSUE_LABELS,
  JOB_LABELS,
  LIST_SYNC_POLL_MS,
  MAX_SHOWN_ITEMS,
  OUTCOME_LABELS,
  STATE_LABELS,
  type ListSyncConfirmation,
  type ListSyncNotice,
  type ListSyncSettingsProps,
} from './model-list-sync-settings';

/** Job states that need polling. */
const ACTIVE_JOB_STATES = new Set([ListSyncJobState.Queued, ListSyncJobState.Running]);

/** Reads and removes the consent result that the provider callback adds to the address. */
function takeCallbackResult(): string | null {
  const url = new URL(window.location.href);
  const result = url.searchParams.get('listSyncResult');

  if (!result) return null;

  url.searchParams.delete('listSync');
  url.searchParams.delete('listSyncResult');
  window.history.replaceState(window.history.state, '', url.href);

  return result;
}

/** Connects external lists and runs separate Export and Import actions. */
export function ListSyncSettings({ ownerId, repository }: ListSyncSettingsProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const [overview, setOverview] = useState<ListSyncOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: ListSyncNotice; error: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState<ListSyncConfirmation | null>(null);
  const [preview, setPreview] = useState<{
    provider: string;
    data: ListSyncImportPreview;
  } | null>(null);

  useEffect(() => {
    const result = takeCallbackResult();

    if (result === 'connected') setNotice({ key: 'listSyncConnected', error: false });
    else if (result)
      setNotice({
        key:
          ERROR_LABELS[result as ListSyncErrorCode] ??
          ERROR_LABELS[ListSyncErrorCode.AuthorizationFailed],
        error: true,
      });
  }, []);

  useEffect(() => {
    let active = true;

    repository
      .overview(ownerId)
      .then((value) => {
        if (!active) return;

        setOverview(value);
        setLoadFailed(false);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, [ownerId, repository, reload]);

  const polling = overview?.providers.some(
    (provider) => provider.connection?.job && ACTIVE_JOB_STATES.has(provider.connection.job.state),
  );

  useEffect(() => {
    if (!polling) return;

    const timer = setTimeout(() => setReload((value) => value + 1), LIST_SYNC_POLL_MS);

    return () => clearTimeout(timer);
  }, [polling, overview]);

  const ready = overview?.providers.find((provider) => provider.connection?.previewReady)?.provider;

  useEffect(() => {
    if (!ready || preview?.provider === ready) return;

    let active = true;

    repository
      .preview(ready, ownerId)
      .then((data) => {
        if (active) setPreview({ provider: ready, data });
      })
      .catch(() => {
        if (active) setNotice({ key: 'listSyncRequestFailed', error: true });
      });

    return () => {
      active = false;
    };
  }, [ready, preview, ownerId, repository]);

  const run = async (action: () => Promise<ListSyncOverview | ListSyncJob | void>) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await action();

      if (result && 'providers' in result) setOverview(result);
      else setReload((value) => value + 1);
    } catch (error) {
      setNotice({
        key:
          error instanceof ListSyncRequestError && error.status === 409
            ? 'listSyncBusy'
            : 'listSyncRequestFailed',
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!confirmation) return;

    const { kind, provider } = confirmation;
    setConfirmation(null);
    void run(() =>
      kind === 'export'
        ? repository.exportList(provider, ownerId)
        : repository.disconnect(provider, ownerId),
    );
  };

  const apply = (
    provider: string,
    additions: string[],
    changes: Map<string, Set<ListSyncField>>,
  ) => {
    if (!preview) return;

    const jobId = preview.data.jobId;
    setPreview(null);
    void run(() =>
      repository.apply(provider, ownerId, {
        jobId,
        additions,
        changes: [...changes]
          .filter(([, fields]) => fields.size > 0)
          .map(([key, fields]) => ({ key, fields: [...fields] })),
      }),
    );
  };

  const cancelPreview = (provider: string) => {
    setPreview(null);
    void run(() => repository.cancelPreview(provider, ownerId));
  };

  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );

  const renderJob = (job: ListSyncJob) => {
    const name = t(JOB_LABELS[job.kind]);

    if (job.state === ListSyncJobState.Queued)
      return <p className="list-sync-settings__job">{t('listSyncQueued', { job: name })}</p>;

    if (job.state === ListSyncJobState.Running)
      return (
        <p className="list-sync-settings__job" role="status">
          {t('listSyncRunning', { job: name, ...job.progress })}
        </p>
      );

    if (job.state === ListSyncJobState.Failed)
      return (
        <p className="list-sync-settings__job list-sync-settings__job--error" role="alert">
          {t('listSyncFailed', { job: name })}{' '}
          {job.error && t(ERROR_LABELS[job.error] ?? 'listSyncErrorProviderUnavailable')}
        </p>
      );

    if (job.state !== ListSyncJobState.Succeeded || job.kind === ListSyncJobKind.ImportPreview)
      return null;

    const counts = Object.entries(job.result?.counts ?? {}) as Array<[ListSyncOutcome, number]>;
    const items = job.result?.items ?? [];

    return (
      <div className="list-sync-settings__result">
        <p className="list-sync-settings__job">
          {t('listSyncSucceeded', { job: name })}{' '}
          {counts.map(([outcome, count]) => t(OUTCOME_LABELS[outcome], { count })).join(' · ')}
        </p>
        {items.length > 0 && (
          <ul className="list-sync-settings__items">
            {items.slice(0, MAX_SHOWN_ITEMS).map((item, index) => (
              <li
                className="list-sync-settings__item"
                key={`${item.entryId ?? item.title}-${index}`}
              >
                {item.title}
                {item.issue && `: ${t(ISSUE_LABELS[item.issue])}`}
              </li>
            ))}
          </ul>
        )}
        {items.length > MAX_SHOWN_ITEMS && (
          <p className="list-sync-settings__job">
            {t('listSyncMoreItems', { count: items.length - MAX_SHOWN_ITEMS })}
          </p>
        )}
      </div>
    );
  };

  const renderProvider = ({ provider, name, connection }: ListSyncProvider) => {
    const job = connection?.job;
    const jobActive = Boolean(job && ACTIVE_JOB_STATES.has(job.state));
    const blocked = busy || jobActive;
    const shownPreview = connection?.previewReady && preview?.provider === provider;

    return (
      <div className="list-sync-settings__provider" key={provider}>
        <div className="list-sync-settings__header">
          <h3 className="list-sync-settings__name">{name}</h3>
          {connection && (
            <span className="list-sync-settings__state">
              {connection.accountName} · {t(STATE_LABELS[connection.state])}
            </span>
          )}
        </div>
        {connection && (connection.lastExportAt || connection.lastImportAt) && (
          <p className="list-sync-settings__dates">
            {connection.lastExportAt &&
              t('listSyncLastExport', { date: date(connection.lastExportAt) })}
            {connection.lastExportAt && connection.lastImportAt && ' · '}
            {connection.lastImportAt &&
              t('listSyncLastImport', { date: date(connection.lastImportAt) })}
          </p>
        )}
        <div className="list-sync-settings__actions">
          {(!connection || connection.state === ListSyncState.AuthorizationRequired) && (
            <Button
              className="fc-button--primary"
              disabled={busy}
              onClick={() => void run(() => repository.connect(provider, ownerId))}
            >
              {t(connection ? 'listSyncReconnect' : 'listSyncConnect')}
            </Button>
          )}
          {connection?.state === ListSyncState.Active && (
            <>
              <Button
                className="fc-button--primary"
                disabled={blocked}
                onClick={() => setConfirmation({ kind: 'export', provider, name })}
              >
                {t('listSyncExport')}
              </Button>
              <Button
                className="fc-button--primary"
                disabled={blocked}
                onClick={() => void run(() => repository.importList(provider, ownerId))}
              >
                {t('listSyncImport')}
              </Button>
              <Button
                disabled={busy}
                onClick={() => void run(() => repository.pause(provider, ownerId))}
              >
                {t('listSyncPause')}
              </Button>
            </>
          )}
          {connection?.state === ListSyncState.Paused && (
            <Button
              disabled={busy}
              onClick={() => void run(() => repository.resume(provider, ownerId))}
            >
              {t('listSyncResume')}
            </Button>
          )}
          {connection && (
            <Button
              disabled={busy}
              onClick={() => setConfirmation({ kind: 'disconnect', provider, name })}
            >
              {t('listSyncDisconnect')}
            </Button>
          )}
        </div>
        {job && !shownPreview && renderJob(job)}
        {shownPreview && preview && (
          <ListSyncPreview
            key={preview.data.jobId}
            preview={preview.data}
            busy={busy}
            onApply={(additions, changes) => apply(provider, additions, changes)}
            onCancel={() => cancelPreview(provider)}
          />
        )}
      </div>
    );
  };

  if (!overview && !loadFailed) return null;

  if (overview && !overview.providers.length) return null;

  return (
    <section className="settings-card">
      <h2 className="settings-card__title">{t('listSync')}</h2>
      <div className="list-sync-settings">
        <p className="list-sync-settings__description">{t('listSyncDescription')}</p>
        {loadFailed && !overview && (
          <div className="list-sync-settings__load-error">
            <p className="list-sync-settings__notice" role="alert">
              {t('listSyncLoadFailed')}
            </p>
            <Button onClick={() => setReload((value) => value + 1)}>{t('retry')}</Button>
          </div>
        )}
        {overview?.providers.map(renderProvider)}
        {notice && (
          <p className="list-sync-settings__notice" role={notice.error ? 'alert' : 'status'}>
            {t(notice.key)}
          </p>
        )}
      </div>
      {confirmation && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
          title={t(
            confirmation.kind === 'export' ? 'listSyncExportTitle' : 'listSyncDisconnectTitle',
            { name: confirmation.name },
          )}
          description={t(
            confirmation.kind === 'export'
              ? 'listSyncExportDescription'
              : 'listSyncDisconnectDescription',
            { name: confirmation.name },
          )}
        >
          <Button onClick={() => setConfirmation(null)}>{t('Cancel')}</Button>
          <Button className="fc-button--primary" onClick={confirm}>
            {t(confirmation.kind === 'export' ? 'listSyncExport' : 'listSyncDisconnect')}
          </Button>
        </ConfirmDialog>
      )}
    </section>
  );
}
