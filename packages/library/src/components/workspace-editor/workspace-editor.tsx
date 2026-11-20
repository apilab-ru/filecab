import { useCallback, useId, useLayoutEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Category,
  Status,
  normalizeSourceUrl,
  titleFor,
  type EntryPatch,
} from '@filecab/contracts';
import { Button, ConfirmDialog } from '@filecab/ui';
import { ProgressControl } from '../progress-control/progress-control';
import { StatusSelect } from '../status-select/status-select';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '../../hooks/use-workspace';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useLocalStore } from '../../hooks/use-local-store';
import { WorkspaceConflictError, type WorkspacePreview } from '../../models/workspace';
import { retainedFields } from '../../domain/catalog-selection';
import { isViewingUrl } from '../../domain/entry-form';
import {
  MERGE_FIELD_LABELS,
  RATING_VALUES,
  type WorkspaceEditorProps,
} from './model-workspace-editor';
import './workspace-editor.scss';

/** Edits catalog and manual drafts with version-bound previews and recoverable failures. */
export function WorkspaceEditor({ draft }: WorkspaceEditorProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const { state, close: closeDraft, rebase, reconcile } = useWorkspace();
  const close = useCallback(() => closeDraft(draft.id), [closeDraft, draft.id]);
  const route = useLocation();
  const navigate = useNavigate();
  const form = useRef<HTMLFormElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const progressHint = useId();
  const locked = useRef(false);
  const entry = draft.row?.entry;
  const [values, setters] = useLocalStore(() => ({
    fields: entry
      ? retainedFields(entry)
      : {
          userTitle: draft.catalog
            ? titleFor(draft.catalog.snapshot, locale, t('Untitled')).text
            : (draft.title ?? ''),
          status: draft.catalog ? Status.Planned : null,
          rating: 0,
          progress: 0,
          comment: '',
        },
    category: entry?.category ?? draft.category,
    // The link is read-only. An edit can only remove it. A Page tab save sets `draft.link`.
    link: entry?.sources[0]?.originalUrl ?? '',
    dirty: Boolean(
      draft.catalog ||
      draft.title ||
      (draft.link && entry?.sources[0]?.normalizedUrl !== normalizeSourceUrl(draft.link)),
    ),
    busy: false,
    error: '',
    conflict: false,
    preview: null as WorkspacePreview | null,
  }));
  const association = Boolean(draft.row && draft.catalog);
  const save = async (): Promise<boolean> => {
    if (locked.current || !form.current?.reportValidity() || !state.repository) return false;

    locked.current = true;
    setters.busy(true);
    setters.error('');
    setters.conflict(false);
    try {
      let sourceUrls: string[] | undefined;

      if (draft.link) sourceUrls = [draft.link];
      else if (entry) sourceUrls = values.link ? [values.link] : [];

      const fields: EntryPatch = {
        ...values.fields,
        category: values.category,
        ...(sourceUrls ? { sourceUrls } : {}),
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
  const titleRequired = !draft.catalog && !entry?.catalogId;
  const pageLink = draft.link ? normalizeSourceUrl(draft.link) : null;
  // A Page tab save moves the link from the entry that holds it now.
  const linkOwner = pageLink
    ? state.rows.find(
        (row) =>
          row.entry.entryId !== entry?.entryId &&
          row.entry.sources.some((source) => source.normalizedUrl === pageLink),
      )
    : undefined;
  const total = (entry?.snapshot ?? draft.catalog?.snapshot)?.episodeCount || null;
  useLayoutEffect(() => {
    titleInput.current?.setCustomValidity(
      titleRequired && !values.fields.userTitle.trim() ? t('blankTitle') : '',
    );
  });
  /** Discards the draft fields and loads the latest saved version of the entry. */
  const reload = () => {
    const latest = state.rows.find(({ entry: row }) => row.entryId === entry?.entryId);

    if (!latest) {
      close();

      return;
    }

    rebase();
    setters.fields(retainedFields(latest.entry));
    setters.category(latest.entry.category);
    setters.link(latest.entry.sources[0]?.originalUrl ?? '');
    setters.dirty(false);
    setters.preview(null);
    setters.error('');
    setters.conflict(false);
  };
  const change = (patch: Partial<typeof values.fields>) => {
    setters.fields((current) => ({ ...current, ...patch }));
    setters.dirty(true);
    setters.preview(null);
  };
  // Find match opens the full-page catalog, so the popup does not offer it.
  const canFindMatch =
    Boolean(entry && !entry.catalogId && !draft.catalog && !values.dirty) &&
    /^\/(library|catalog)\//.test(route.pathname);
  const cancel = () => {
    if (values.busy) return;

    close();
  };

  return (
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
            ref={titleInput}
            className="workspace-editor__input"
            name="title"
            required={titleRequired}
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
        <div className="workspace-editor__field workspace-editor__field--inline">
          <span aria-hidden="true">{t('Status')}</span>
          <StatusSelect
            allowNone
            value={values.fields.status}
            onChange={(status) => change({ status })}
          />
        </div>
        <label className="workspace-editor__field">
          {t('Rating')}
          <select
            className="workspace-editor__input"
            aria-label={t('Rating')}
            value={values.fields.rating}
            onChange={(event) => change({ rating: Number(event.target.value) })}
          >
            <option value={0}>{t('unrated')}</option>
            {RATING_VALUES.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>
        <div className="workspace-editor__field">
          <span aria-hidden="true">{t('Progress')}</span>
          <ProgressControl
            live
            value={values.fields.progress}
            total={total}
            describedBy={progressHint}
            onChange={(progress) => change({ progress })}
          />
        </div>
        <p id={progressHint} className="workspace-editor__hint">
          {total === null && t('episodeTotalUnknown')}
          {total !== null && t('episodeTotal', { total })}
        </p>
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
        {linkOwner && (
          <p className="workspace-editor__hint workspace-editor__hint--warning" role="status">
            {t('linkMoves', {
              title: titleFor(
                linkOwner.entry.snapshot,
                locale,
                t('Untitled'),
                linkOwner.entry.userTitle,
              ).text,
            })}
          </p>
        )}
        {entry && !draft.link && (
          <div className="workspace-editor__field">
            {t('ViewingLink')}
            <div className="workspace-editor__link">
              {values.link && isViewingUrl(values.link) && (
                <a
                  className="workspace-editor__link-url"
                  href={values.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {values.link}
                </a>
              )}
              {values.link && !isViewingUrl(values.link) && (
                <span className="workspace-editor__link-url">{values.link}</span>
              )}
              {!values.link && <span className="workspace-editor__hint">{t('noLink')}</span>}
              {values.link && (
                <Button
                  type="button"
                  disabled={association}
                  onClick={() => {
                    setters.link('');
                    setters.dirty(true);
                    setters.preview(null);
                  }}
                >
                  {t('removeLink')}
                </Button>
              )}
            </div>
          </div>
        )}
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
                        event.target.value === 'other' ? draft.other!.entry[field] : entry![field],
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
                  <dt>{t('ViewingLink')}</dt>
                  <dd>{proposed.sources[0]?.originalUrl ?? t('noLink')}</dd>
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
        {values.error && !(draft.row && values.conflict) && (
          <p className="workspace-editor__error" role="alert">
            {t(values.error, { defaultValue: values.error })}
          </p>
        )}
        {draft.row && values.conflict && (
          <section className="workspace-editor__conflict" role="alert">
            <p className="workspace-editor__error">{t('entryConflict')}</p>
            <div className="workspace-editor__actions">
              <Button type="button" onClick={reload}>
                {t('Reload entry')}
              </Button>
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
            </div>
          </section>
        )}
        <div className="workspace-editor__actions">
          <Button
            type="submit"
            disabled={values.busy || !values.dirty || values.conflict || !state.repository}
          >
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
  );
}
