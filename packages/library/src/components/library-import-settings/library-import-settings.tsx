import './library-import-settings.scss';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Icon, IconName } from '@filecab/ui';
import { LibraryImportOutcome, type LibraryImportIssue } from '@filecab/contracts';
import { useWorkspace } from '../../hooks/use-workspace';
import { WorkspaceConflictError } from '../../models/workspace';
import {
  ISSUE_LABELS,
  MAX_SHOWN_ISSUES,
  REASON_LABELS,
  type LibraryImportPending,
  type LibraryImportSettingsProps,
} from './model-library-import-settings';

/** Adds entries from a CSV file after a check, a preview with row selection and a confirmation. */
export function LibraryImportSettings({ importUrl, onImported }: LibraryImportSettingsProps) {
  const { t } = useTranslation();
  const { state, toast } = useWorkspace();
  const importer = state.repository?.importer;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<LibraryImportIssue[]>([]);
  const [pending, setPending] = useState<LibraryImportPending | null>(null);

  const selectFile = async (file: File | undefined) => {
    if (input.current) input.current.value = '';

    if (!file) return;

    setIssues([]);

    if (!importer) {
      toast(t('libraryImportUnavailable'), true);

      return;
    }

    setBusy(true);
    try {
      const plan = await importer.previewImport(await file.text());

      if (plan.issues.length) setIssues(plan.issues);
      else
        setPending({
          plan,
          // Possible duplicates stay out until the owner selects them.
          selected: new Set(
            plan.rows
              .filter((row) => row.outcome === LibraryImportOutcome.Add)
              .map((row) => row.line),
          ),
        });
    } catch {
      toast(t('libraryImportFailed'), true);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (line: number) => {
    if (!pending) return;

    const selected = new Set(pending.selected);

    if (selected.has(line)) selected.delete(line);
    else selected.add(line);

    setPending({ ...pending, selected });
  };

  const selectAll = (all: boolean) => {
    if (!pending) return;

    setPending({
      ...pending,
      selected: new Set(
        all
          ? pending.plan.rows
              .filter((row) => row.outcome !== LibraryImportOutcome.Skip)
              .map((row) => row.line)
          : [],
      ),
    });
  };

  const confirm = async () => {
    if (!pending) return;

    setBusy(true);
    try {
      const summary = await pending.plan.confirm([...pending.selected]);
      toast(t('libraryImportDone', { added: summary.added, skipped: summary.skipped }));

      if (summary.entries.length) onImported?.(summary.entries);
    } catch (error) {
      toast(
        t(error instanceof WorkspaceConflictError ? 'libraryImportStale' : 'libraryImportFailed'),
        true,
      );
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const rows = pending?.plan.rows ?? [];
  const count = (outcome: LibraryImportOutcome) =>
    rows.filter((row) => row.outcome === outcome).length;

  return (
    <div className="library-import-settings">
      <p className="library-import-settings__description">{t('libraryImportDescription')}</p>
      <div className="library-import-settings__actions">
        {importUrl ? (
          <a
            className="fc-button library-import-settings__button"
            href={importUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name={IconName.External} />
            {t('libraryImportFullPage')}
          </a>
        ) : (
          <>
            <Button
              className="library-import-settings__button"
              disabled={busy || !importer}
              onClick={() => input.current?.click()}
            >
              {t('libraryImportChoose')}
            </Button>
            <input
              ref={input}
              className="library-import-settings__file"
              type="file"
              accept=".csv,text/csv,text/plain"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
          </>
        )}
      </div>
      {issues.length > 0 && (
        <div className="library-import-settings__issues" role="alert">
          <p className="library-import-settings__notice">
            {t('libraryImportInvalid', { count: issues.length })}
          </p>
          <ul className="library-import-settings__issue-list">
            {issues.slice(0, MAX_SHOWN_ISSUES).map((issue, index) => (
              <li className="library-import-settings__issue" key={index}>
                {issue.line > 0
                  ? t('libraryImportLine', { line: issue.line })
                  : t('libraryImportFile')}
                {issue.column && ` · ${issue.column}`}: {t(ISSUE_LABELS[issue.code])}
              </li>
            ))}
          </ul>
          {issues.length > MAX_SHOWN_ISSUES && (
            <p className="library-import-settings__notice">
              {t('libraryImportIssuesMore', { count: issues.length - MAX_SHOWN_ISSUES })}
            </p>
          )}
        </div>
      )}
      {pending && (
        <ConfirmDialog
          open
          wide
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
          title={t('libraryImportPreviewTitle')}
          description={t('libraryImportPreviewSummary', {
            add: count(LibraryImportOutcome.Add),
            duplicates: count(LibraryImportOutcome.PossibleDuplicate),
            skip: count(LibraryImportOutcome.Skip),
          })}
        >
          <div className="library-import-settings__select">
            <Button disabled={busy} onClick={() => selectAll(true)}>
              {t('libraryImportSelectAll')}
            </Button>
            <Button disabled={busy} onClick={() => selectAll(false)}>
              {t('libraryImportSelectNone')}
            </Button>
          </div>
          <ul className="library-import-settings__rows">
            {rows.map((row) => {
              const skipped = row.outcome === LibraryImportOutcome.Skip;
              const status = row.status ? t(row.status) : '';

              return (
                <li
                  className="library-import-settings__row"
                  data-outcome={row.outcome}
                  key={row.line}
                >
                  <label className="library-import-settings__row-label">
                    <input
                      type="checkbox"
                      checked={!skipped && pending.selected.has(row.line)}
                      disabled={busy || skipped}
                      onChange={() => toggle(row.line)}
                    />
                    <span className="library-import-settings__row-title">
                      {row.title}
                      {row.year !== null && ` (${row.year})`}
                    </span>
                  </label>
                  <span className="library-import-settings__row-meta">
                    {t(row.category)}
                    {status &&
                      ` · ${row.statusFromRating ? t('libraryImportFromRating', { status }) : status}`}
                    {row.rating > 0 && ` · ★ ${row.rating}`}
                    {row.reason && ` · ${t(REASON_LABELS[row.reason])}`}
                  </span>
                </li>
              );
            })}
          </ul>
          <Button disabled={busy} onClick={() => setPending(null)}>
            {t('Cancel')}
          </Button>
          <Button
            className="fc-button--primary"
            disabled={busy || pending.selected.size === 0}
            onClick={confirm}
          >
            {t('libraryImportConfirm', { count: pending.selected.size })}
          </Button>
        </ConfirmDialog>
      )}
    </div>
  );
}
