import './catalog-match-settings.scss';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import {
  CatalogMatchJobState,
  CatalogMatchOutcome,
  CatalogMatchPause,
  type CatalogMatchJob,
  type CatalogMatchStatus,
} from '@filecab/contracts';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useWorkspace } from '../../hooks/use-workspace';
import { CatalogMatchBusyError } from '../../models/catalog-match';
import type { WorkspaceRow } from '../../models/workspace';
import { CatalogMatchResolve } from '../catalog-match-resolve/catalog-match-resolve';
import {
  CATALOG_MATCH_POLL_MS,
  COUNT_LABELS,
  COUNT_ORDER,
  ITEM_LABELS,
  MAX_SHOWN_ITEMS,
  PROVIDER_LABELS,
  RESOLVABLE,
  type CatalogMatchSettingsProps,
} from './model-catalog-match-settings';

/** Job states that need polling. */
const ACTIVE_STATES = new Set([CatalogMatchJobState.Queued, CatalogMatchJobState.Running]);

/** Accepts only job objects, so an unexpected response shows no jobs. */
function jobsOf(status: CatalogMatchStatus | null | undefined): CatalogMatchJob[] {
  const jobs = status?.jobs;

  return Array.isArray(jobs)
    ? jobs.filter((job) => job && typeof job === 'object' && typeof job.state === 'string')
    : [];
}

/** Starts, stops and shows the server jobs, one for each provider, that find catalog data. */
export function CatalogMatchSettings({ ownerId, repository, imported }: CatalogMatchSettingsProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state: workspace, toast } = useWorkspace();
  const [jobs, setJobs] = useState<CatalogMatchJob[]>([]);
  const [resolving, setResolving] = useState<WorkspaceRow | null>(null);
  const rows = new Map(workspace.rows.map((row) => [row.entry.entryId, row]));
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    repository
      .status(ownerId)
      .then((status) => {
        if (active) setJobs(jobsOf(status));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [ownerId, repository, reload]);

  const running = jobs.some((job) => ACTIVE_STATES.has(job.state));

  useEffect(() => {
    if (!running) return;

    const timer = setTimeout(() => setReload((value) => value + 1), CATALOG_MATCH_POLL_MS);

    return () => clearTimeout(timer);
  }, [running, jobs]);

  const act = async (action: () => Promise<CatalogMatchStatus>, start = false) => {
    setBusy(true);
    try {
      const next = jobsOf(await action());
      setJobs(next);

      if (start && !next.some((job) => ACTIVE_STATES.has(job.state)))
        toast(t('catalogMatchNothing'));
    } catch (error) {
      toast(
        t(
          error instanceof CatalogMatchBusyError ? 'catalogMatchBusy' : 'catalogMatchRequestFailed',
        ),
        true,
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (imported?.length) void act(() => repository.start(ownerId, imported), true);
  }, [imported]);

  const time = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );

  const state = (job: CatalogMatchJob) => {
    if (job.pause === CatalogMatchPause.ProviderLimit && job.resumeAt)
      return t('catalogMatchProviderLimit', { ...job.progress, time: time(job.resumeAt) });

    if (job.pause === CatalogMatchPause.WaitingSync) return t('catalogMatchWaitingSync');

    if (job.state === CatalogMatchJobState.Running && job.progress.done > 0)
      return t('catalogMatchRunning', job.progress);

    if (ACTIVE_STATES.has(job.state)) return t('catalogMatchQueued');

    if (job.state === CatalogMatchJobState.Failed) return t('catalogMatchFailed');

    if (job.state === CatalogMatchJobState.Cancelled) return t('catalogMatchCancelled');

    return t('catalogMatchSucceeded');
  };

  return (
    <div className="catalog-match-settings">
      <p className="catalog-match-settings__description">{t('catalogMatchDescription')}</p>
      <div className="catalog-match-settings__actions">
        <Button
          className="catalog-match-settings__button"
          disabled={busy}
          onClick={() => void act(() => repository.start(ownerId), true)}
        >
          {t('catalogMatchStart')}
        </Button>
        {running && (
          <Button disabled={busy} onClick={() => void act(() => repository.stop(ownerId))}>
            {t('catalogMatchStop')}
          </Button>
        )}
      </div>
      {jobs.map((job) => {
        const label =
          job.provider in PROVIDER_LABELS
            ? PROVIDER_LABELS[job.provider as keyof typeof PROVIDER_LABELS]
            : null;
        const counts = COUNT_ORDER.filter((outcome) => job.counts[outcome]).map((outcome) =>
          t(COUNT_LABELS[outcome], { value: job.counts[outcome] ?? 0 }),
        );
        // An entry that the owner linked or deleted since the job is no longer listed.
        const items = job.items.filter((item) => {
          const row = rows.get(item.entryId);

          return (
            item.outcome !== CatalogMatchOutcome.Linked &&
            !row?.entry.catalogId &&
            !row?.entry.deleted
          );
        });

        return (
          <div
            className="catalog-match-settings__job"
            role="status"
            data-provider={job.provider}
            key={job.jobId}
          >
            <h3 className="catalog-match-settings__provider">{label ? t(label) : job.provider}</h3>
            <p className="catalog-match-settings__state">
              {state(job)} {counts.join(' · ')}
            </p>
            {items.length > 0 && (
              <ul className="catalog-match-settings__items">
                {items.slice(0, MAX_SHOWN_ITEMS).map((item) => {
                  const row = rows.get(item.entryId);
                  const text = `${item.title || item.entryId}: ${t(
                    ITEM_LABELS[item.outcome as Exclude<CatalogMatchOutcome, 'linked'>],
                  )}`;

                  return (
                    <li className="catalog-match-settings__item" key={item.entryId}>
                      {row && RESOLVABLE.has(item.outcome) ? (
                        <button
                          className="catalog-match-settings__resolve"
                          type="button"
                          title={t('catalogMatchResolve')}
                          onClick={() => setResolving(row)}
                        >
                          {text}
                        </button>
                      ) : (
                        text
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length > MAX_SHOWN_ITEMS && (
              <p className="catalog-match-settings__state">
                {t('catalogMatchMoreItems', { value: items.length - MAX_SHOWN_ITEMS })}
              </p>
            )}
          </div>
        );
      })}
      {resolving && (
        <CatalogMatchResolve
          key={resolving.entry.entryId}
          row={resolving}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  );
}
