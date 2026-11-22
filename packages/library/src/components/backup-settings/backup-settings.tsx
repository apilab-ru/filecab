import './backup-settings.scss';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Icon, IconName } from '@filecab/ui';
import type { ValidationIssue } from '@filecab/contracts';
import { useWorkspace } from '../../hooks/use-workspace';
import { BackupValidationError } from '../../models/backup';
import { WorkspaceConflictError } from '../../models/workspace';
import { downloadJsonFile } from '../../domain/download-json-file';
import {
  BACKUP_ERRORS,
  BACKUP_FILE_NAME,
  MAX_SHOWN_ISSUES,
  type BackupNotice,
  type BackupPreviewState,
  type BackupSettingsProps,
} from './model-backup-settings';

/** Exports the library and restores it from a validated, previewed and confirmed backup. */
export function BackupSettings({ restoreUrl }: BackupSettingsProps) {
  const { t } = useTranslation();
  const backup = useWorkspace().state.repository?.backup;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<BackupNotice>('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [pending, setPending] = useState<BackupPreviewState | null>(null);

  const reset = () => {
    setNotice('');
    setIssues([]);
  };

  const exportLibrary = async () => {
    reset();

    if (!backup) {
      setNotice('backupUnavailable');

      return;
    }

    setBusy(true);
    try {
      downloadJsonFile(await backup.exportBackup(), BACKUP_FILE_NAME);
    } catch {
      setNotice('backupExportFailed');
    } finally {
      setBusy(false);
    }
  };

  const selectFile = async (file: File | undefined) => {
    if (input.current) input.current.value = '';

    if (!file) return;

    reset();

    if (!backup) {
      setNotice('backupUnavailable');

      return;
    }

    setBusy(true);
    try {
      setPending({ preview: await backup.previewRestore(await file.text()), emptyStage: false });
    } catch (error) {
      if (error instanceof BackupValidationError && error.issues.length) setIssues(error.issues);
      else if (error instanceof BackupValidationError) setNotice('backupInvalidUnknown');
      else setNotice('backupFailed');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!pending) return;

    if (!pending.preview.comparison.incoming && !pending.emptyStage) {
      setPending({ ...pending, emptyStage: true });

      return;
    }

    setBusy(true);
    try {
      await pending.preview.confirm(pending.emptyStage);
      setNotice('backupRestored');
    } catch (error) {
      setNotice(error instanceof WorkspaceConflictError ? 'backupStale' : 'backupFailed');
    } finally {
      setPending(null);
      setBusy(false);
    }
  };

  const comparison = pending?.preview.comparison;

  return (
    <div className="backup-settings">
      <p className="backup-settings__description">{t('backupDescription')}</p>
      <div className="backup-settings__actions">
        <Button
          className="backup-settings__button"
          disabled={busy || !backup}
          onClick={exportLibrary}
        >
          {t('backupExport')}
        </Button>
        {restoreUrl ? (
          <a
            className="fc-button backup-settings__button"
            href={restoreUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name={IconName.External} />
            {t('backupRestoreFullPage')}
          </a>
        ) : (
          <>
            <Button
              className="backup-settings__button"
              disabled={busy || !backup}
              onClick={() => input.current?.click()}
            >
              {t('backupRestore')}
            </Button>
            <input
              ref={input}
              className="backup-settings__file"
              type="file"
              accept="application/json,.json"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void selectFile(event.target.files?.[0])}
            />
          </>
        )}
      </div>
      {notice && (
        <p
          className="backup-settings__notice"
          role={BACKUP_ERRORS.has(notice) ? 'alert' : 'status'}
        >
          {t(notice)}
        </p>
      )}
      {issues.length > 0 && (
        <div className="backup-settings__issues" role="alert">
          <p className="backup-settings__notice">{t('backupInvalid', { count: issues.length })}</p>
          <ul className="backup-settings__issue-list">
            {issues.slice(0, MAX_SHOWN_ISSUES).map((issue, index) => (
              <li className="backup-settings__issue" key={index}>
                {issue.path[0] === 'entries' && typeof issue.path[1] === 'number'
                  ? t('backupIssueEntry', { index: issue.path[1] + 1 })
                  : t('backupIssueFile')}
                {issue.path.length > 2 && ` · ${issue.path.slice(2).join('.')}`}: {issue.message}
              </li>
            ))}
          </ul>
          {issues.length > MAX_SHOWN_ISSUES && (
            <p className="backup-settings__notice">
              {t('backupIssuesMore', { count: issues.length - MAX_SHOWN_ISSUES })}
            </p>
          )}
        </div>
      )}
      {pending && comparison && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setPending(null);
          }}
          title={t(pending.emptyStage ? 'backupEmptyTitle' : 'backupPreviewTitle')}
          description={
            pending.emptyStage
              ? t('backupEmptyDescription', { count: comparison.current })
              : t('backupPreviewDescription', { ...comparison })
          }
        >
          {!pending.emptyStage && comparison.conflicts > 0 && (
            <p className="backup-settings__conflicts">
              {t('backupConflicts', { count: comparison.conflicts })}
            </p>
          )}
          <Button disabled={busy} onClick={exportLibrary}>
            {t('backupDownloadCurrent')}
          </Button>
          <Button disabled={busy} onClick={() => setPending(null)}>
            {t('Cancel')}
          </Button>
          <Button className="fc-button--primary" disabled={busy} onClick={confirm}>
            {t(pending.emptyStage ? 'backupEmptyConfirm' : 'backupConfirm')}
          </Button>
        </ConfirmDialog>
      )}
    </div>
  );
}
