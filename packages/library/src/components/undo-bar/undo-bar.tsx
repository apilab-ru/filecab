import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import { useWorkspace } from '../../hooks/use-workspace';
import './undo-bar.scss';

/** Shows recent deletions with Undo and reports delete and Undo failures. */
export function UndoBar() {
  const { t } = useTranslation();
  const { deletions, notice, undo } = useWorkspace();

  if (!deletions.length && !notice) return null;

  return (
    <div className="undo-bar">
      {deletions.map((deletion) => (
        <p className="undo-bar__item" role="status" key={deletion.tombstone.entry.entryId}>
          <span className="undo-bar__text">{t('deletedTitle', { title: deletion.title })}</span>
          <Button onClick={() => void undo(deletion)}>{t('Undo')}</Button>
        </p>
      ))}
      {notice && (
        <p className="undo-bar__item undo-bar__item--error" role="alert">
          {t(notice)}
        </p>
      )}
    </div>
  );
}
