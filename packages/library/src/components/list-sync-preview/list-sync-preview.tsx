import './list-sync-preview.scss';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import { ListSyncField, Status } from '@filecab/contracts';
import { FIELD_LABELS, type ListSyncPreviewProps } from './model-list-sync-preview';

/** Lets the owner select the additions and field changes of an import preview. */
export function ListSyncPreview({ preview, busy, onApply, onCancel }: ListSyncPreviewProps) {
  const { t } = useTranslation();
  const [additions, setAdditions] = useState(
    () => new Set(preview.additions.map((addition) => addition.key)),
  );
  const [changes, setChanges] = useState(
    () =>
      new Map(
        preview.changes.map((change) => [
          change.key,
          new Set(change.fields.map((field) => field.field)),
        ]),
      ),
  );

  const value = (field: ListSyncField, current: Status | number | null) => {
    if (field === ListSyncField.Status)
      return current === null ? t('listSyncNoValue') : t(current as Status);

    if (field === ListSyncField.Rating && current === 0) return t('listSyncNoValue');

    return String(current);
  };

  const toggleAddition = (key: string) => {
    const next = new Set(additions);

    if (next.has(key)) next.delete(key);
    else next.add(key);

    setAdditions(next);
  };

  const toggleField = (key: string, field: ListSyncField) => {
    const next = new Map(changes);
    const fields = new Set(next.get(key));

    if (fields.has(field)) fields.delete(field);
    else fields.add(field);

    next.set(key, fields);
    setChanges(next);
  };

  const selected =
    additions.size + [...changes.values()].reduce((count, fields) => count + fields.size, 0);
  const empty = !preview.additions.length && !preview.changes.length;

  return (
    <div className="list-sync-preview">
      <h3 className="list-sync-preview__title">{t('listSyncPreviewTitle')}</h3>
      <p className="list-sync-preview__summary">
        {empty
          ? t('listSyncPreviewEmpty')
          : t('listSyncPreviewSummary', {
              additions: preview.additions.length,
              changes: preview.changes.length,
              unchanged: preview.unchanged,
            })}
      </p>
      {preview.additions.length > 0 && (
        <fieldset className="list-sync-preview__group">
          <legend className="list-sync-preview__legend">{t('listSyncPreviewAdditions')}</legend>
          {preview.additions.map((addition) => (
            <label className="list-sync-preview__option" key={addition.key}>
              <input
                type="checkbox"
                checked={additions.has(addition.key)}
                disabled={busy}
                onChange={() => toggleAddition(addition.key)}
              />
              <span>
                {addition.title} · {value(ListSyncField.Status, addition.values.status)}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {preview.changes.length > 0 && (
        <fieldset className="list-sync-preview__group">
          <legend className="list-sync-preview__legend">{t('listSyncPreviewChanges')}</legend>
          {preview.changes.map((change) => (
            <div className="list-sync-preview__change" key={change.key}>
              <p className="list-sync-preview__change-title">{change.title}</p>
              {change.fields.map((field) => (
                <label className="list-sync-preview__option" key={field.field}>
                  <input
                    type="checkbox"
                    checked={changes.get(change.key)?.has(field.field) ?? false}
                    disabled={busy}
                    onChange={() => toggleField(change.key, field.field)}
                  />
                  <span>
                    {t('listSyncChangeValue', {
                      field: t(FIELD_LABELS[field.field]),
                      current: value(field.field, field.current),
                      incoming: value(field.field, field.incoming),
                    })}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </fieldset>
      )}
      <div className="list-sync-preview__actions">
        <Button disabled={busy} onClick={onCancel}>
          {t('Cancel')}
        </Button>
        {!empty && (
          <Button
            className="fc-button--primary"
            disabled={busy || selected === 0}
            onClick={() => onApply([...additions], changes)}
          >
            {t('listSyncApply')}
          </Button>
        )}
      </div>
    </div>
  );
}
