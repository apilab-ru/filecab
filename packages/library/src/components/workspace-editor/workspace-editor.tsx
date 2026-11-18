import { useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Category, Status, titleFor, type EntryPatch } from '@filecab/contracts';
import { Button, ConfirmDialog } from '@filecab/ui';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../../hooks/use-workspace';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useLocalStore } from '../../hooks/use-local-store';
import { Context } from '../../models/interface-context';
import { WorkspaceConflictError, type WorkspacePreview } from '../../models/workspace';
import { retainedFields } from '../../domain/catalog-selection';
import { MERGE_FIELD_LABELS, type WorkspaceEditorProps } from './model-workspace-editor';
import './workspace-editor.scss';

/** Edits catalog and manual drafts with version-bound previews and recoverable failures. */
export function WorkspaceEditor({ draft }: WorkspaceEditorProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, close: closeDraft, rebase, reconcile } = useWorkspace();
  const close = useCallback(() => closeDraft(draft.id), [closeDraft, draft.id]);
  const route = useLocation();
  const navigate = useNavigate();
  const { setDirty } = useContext(Context);
  const form = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const entry = draft.row?.entry;
  const [values, setters] = useLocalStore(() => ({
    fields: entry
      ? retainedFields(entry)
      : {
          userTitle: draft.catalog
            ? titleFor(draft.catalog.snapshot, locale, t('Untitled')).text
            : '',
          status: draft.catalog ? Status.Planned : null,
          rating: 0,
          progress: 0,
          comment: '',
        },
    category: entry?.category ?? draft.category,
    sources: entry?.sources.map(({ originalUrl }) => originalUrl).join('\n') ?? '',
    dirty: Boolean(draft.catalog),
    busy: false,
    error: '',
    conflict: false,
    discard: false,
    preview: null as WorkspacePreview | null,
  }));
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  const association = Boolean(draft.row && draft.catalog);
  const save = async (): Promise<boolean> => {
    if (locked.current || !form.current?.reportValidity() || !state.repository) return false;

    locked.current = true;
    setters.busy(true);
    setters.error('');
    setters.conflict(false);
    try {
      const fields: EntryPatch = {
        ...values.fields,
        category: values.category,
        sourceUrls: values.sources
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };

      if (association && draft.row && draft.catalog) {
        if (!values.preview) {
          const preview = await state.repository.preview(
            draft.row,
            draft.catalog,
            draft.other,
            values.fields,
          );
          setters.preview(preview);

          return false;
        }

        await values.preview.confirm();
      } else {
        await state.repository.save(
          draft.row?.entry.entryId ?? draft.id,
          values.category,
          fields,
          draft.row,
          draft.catalog,
        );
      }

      setters.dirty(false);
      close();

      return true;
    } catch (error) {
      setters.error('catalogSaveFailed');
      setters.conflict(error instanceof WorkspaceConflictError);
      setters.preview(null);
      void state.repository.refresh().catch(() => {});

      return false;
    } finally {
      locked.current = false;
      setters.busy(false);
    }
  };
  saveRef.current = save;
  useLayoutEffect(() => {
    setDirty(values.dirty ? { save: () => saveRef.current(), discard: close } : null);

    return () => setDirty(null);
  }, [values.dirty, setDirty, close]);
  const change = (patch: Partial<typeof values.fields>) => {
    setters.fields((current) => ({ ...current, ...patch }));
    setters.dirty(true);
    setters.preview(null);
  };
  // The popup keeps catalog search as a placeholder, so matching is only offered on full-page routes.
  const canFindMatch =
    Boolean(entry && !entry.catalogId && !draft.catalog && !values.dirty) &&
    /^\/(library|catalog)\//.test(route.pathname);
  const cancel = () => {
    if (values.busy) return;

    if (values.dirty) setters.discard(true);
    else close();
  };

  return (
    <>
      <ConfirmDialog
        open
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
        title={t(entry ? 'Edit' : 'addTitle')}
        description={t(association ? 'catalogAssociationDescription' : 'catalogDraftDescription')}
      >
        <form
          className="workspace-editor"
          ref={form}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="workspace-editor__field">
            {t('Title')}
            <input
              className="workspace-editor__input"
              name="title"
              required={!draft.catalog && !entry?.catalogId}
              maxLength={10000}
              value={values.fields.userTitle}
              onChange={(event) => change({ userTitle: event.target.value })}
            />
          </label>
          <label className="workspace-editor__field">
            {t('Category')}
            <select
              className="workspace-editor__input"
              disabled={Boolean(draft.catalog || entry?.catalogId)}
              value={values.category}
              onChange={(event) => {
                setters.category(event.target.value as Category);
                setters.dirty(true);
              }}
            >
              {Object.values(Category).map((category) => (
                <option key={category} value={category}>
                  {t(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace-editor__field">
            {t('Status')}
            <select
              className="workspace-editor__input"
              aria-label={t('Status')}
              value={values.fields.status ?? ''}
              onChange={(event) =>
                change({ status: (event.target.value || null) as Status | null })
              }
            >
              <option value="">{t('No status')}</option>
              {Object.values(Status).map((status) => (
                <option key={status} value={status}>
                  {t(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="workspace-editor__field">
            {t('Rating')}
            <input
              className="workspace-editor__input"
              type="number"
              min={0}
              max={10}
              step={1}
              value={values.fields.rating}
              onChange={(event) => change({ rating: Number(event.target.value) })}
            />
          </label>
          <label className="workspace-editor__field">
            {t('Progress')}
            <input
              className="workspace-editor__input"
              type="number"
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              value={values.fields.progress}
              onChange={(event) => change({ progress: Number(event.target.value) })}
            />
          </label>
          <label className="workspace-editor__field">
            {t('Comment')}
            <textarea
              className="workspace-editor__input"
              aria-label={t('Comment')}
              maxLength={100000}
              value={values.fields.comment}
              onChange={(event) => change({ comment: event.target.value })}
            />
          </label>
          <label className="workspace-editor__field">
            {t('Viewing URLs (one per line)')}
            <textarea
              className="workspace-editor__input"
              aria-label={t('Viewing URLs (one per line)')}
              disabled={association}
              value={values.sources}
              onChange={(event) => {
                setters.sources(event.target.value);
                setters.dirty(true);
              }}
            />
          </label>
          {draft.other && (
            <section className="workspace-editor__merge">
              <p>{t('catalogMergeChoices')}</p>
              {(Object.keys(values.fields) as (keyof typeof values.fields)[]).map((field) => (
                <label className="workspace-editor__field" key={field}>
                  {t(MERGE_FIELD_LABELS[field])}
                  <select
                    className="workspace-editor__input"
                    defaultValue="survivor"
                    onChange={(event) =>
                      change({
                        [field]:
                          event.target.value === 'other'
                            ? draft.other!.entry[field]
                            : entry![field],
                      })
                    }
                  >
                    <option value="survivor">
                      {t('catalogKeepManual')}: {String(entry![field] ?? '')}
                    </option>
                    <option value="other">
                      {t('catalogKeepSaved')}: {String(draft.other!.entry[field] ?? '')}
                    </option>
                  </select>
                </label>
              ))}
            </section>
          )}
          {values.preview && (
            <section className="workspace-editor__preview" aria-label={t('catalogPreview')}>
              <h3 className="workspace-editor__preview-title">{t('catalogPreview')}</h3>
              {values.preview.changes.map(({ before, proposed }) => (
                <div className="workspace-editor__preview-entry" key={before.entryId}>
                  <p>{before.userTitle || before.entryId}</p>
                  <dl>
                    <dt>{t('Title')}</dt>
                    <dd>{proposed.userTitle}</dd>
                    <dt>{t('Status')}</dt>
                    <dd>{proposed.status ? t(proposed.status) : t('No status')}</dd>
                    <dt>{t('Rating')}</dt>
                    <dd>{proposed.rating}</dd>
                    <dt>{t('Progress')}</dt>
                    <dd>{proposed.progress}</dd>
                    <dt>{t('Comment')}</dt>
                    <dd>{proposed.comment}</dd>
                    <dt>{t('Viewing URLs (one per line)')}</dt>
                    <dd>{proposed.sources.map(({ originalUrl }) => originalUrl).join('\n')}</dd>
                    <dt>{t('catalogRetainedIdentity')}</dt>
                    <dd>
                      {proposed.entryId} · {proposed.createdAt}
                    </dd>
                    <dt>{t('catalogAction')}</dt>
                    <dd>{t(proposed.deleted ? 'Deleted' : 'catalogKeep')}</dd>
                  </dl>
                </div>
              ))}
            </section>
          )}
          {values.error && (
            <p className="workspace-editor__error" role="alert">
              {t(values.error, { defaultValue: values.error })}
              {draft.row && values.conflict && (
                <Button
                  type="button"
                  onClick={() => {
                    rebase();
                    setters.preview(null);
                    setters.error('');
                    setters.conflict(false);
                  }}
                >
                  {t('catalogRebase')}
                </Button>
              )}
            </p>
          )}
          <div className="workspace-editor__actions">
            <Button type="submit" disabled={values.busy || !state.repository}>
              {t(values.preview ? 'catalogConfirm' : 'save')}
            </Button>
            <Button type="button" disabled={values.busy} onClick={cancel}>
              {t('Cancel')}
            </Button>
            {canFindMatch && (
              <Button
                type="button"
                onClick={() => {
                  reconcile(draft.row!);
                  close();
                  navigate(
                    `/catalog/${entry!.category}${new URLSearchParams(route.search).get('view') === 'list' ? '?view=list' : ''}`,
                  );
                }}
              >
                {t('catalogFindMatch')}
              </Button>
            )}
          </div>
        </form>
      </ConfirmDialog>
      <ConfirmDialog
        open={values.discard}
        onOpenChange={setters.discard}
        title={t('unsaved')}
        description={t('unsavedDescription')}
      >
        <Button onClick={close}>{t('discard')}</Button>
        <Button onClick={() => setters.discard(false)}>{t('continueEditing')}</Button>
      </ConfirmDialog>
    </>
  );
}
