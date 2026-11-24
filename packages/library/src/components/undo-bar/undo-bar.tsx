import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import { useWorkspace } from '../../hooks/use-workspace';
import './undo-bar.scss';

/** The stack shows at most three messages. Older messages leave first. */
const MAX_SHOWN = 3;

/** Shows recent deletions with Undo, failures and short toast messages. */
export function UndoBar() {
  const { t } = useTranslation();
  const { deletions, notice, undo, toasts, dismissToast } = useWorkspace();
  const items: ReactElement[] = [
    ...deletions.map((deletion) => (
      <p className="undo-bar__item" role="status" key={deletion.tombstone.entry.entryId}>
        <span className="undo-bar__text">{t('deletedTitle', { title: deletion.title })}</span>
        <Button onClick={() => void undo(deletion)}>{t('Undo')}</Button>
      </p>
    )),
    ...(notice
      ? [
          <p className="undo-bar__item undo-bar__item--error" role="alert" key="notice">
            {t(notice)}
          </p>,
        ]
      : []),
    ...toasts.map((toast) => (
      <p
        className={`undo-bar__item${toast.error ? ' undo-bar__item--error' : ''}`}
        role={toast.error ? 'alert' : 'status'}
        key={toast.id}
      >
        <span className="undo-bar__message">{toast.message}</span>
        <button
          type="button"
          className="undo-bar__close"
          aria-label={t('closeMessage')}
          onClick={() => dismissToast(toast.id)}
        >
          <span aria-hidden="true">×</span>
        </button>
      </p>
    )),
  ];

  if (!items.length) return null;

  return <div className="undo-bar">{items.slice(-MAX_SHOWN)}</div>;
}
