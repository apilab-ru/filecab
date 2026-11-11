import { useTranslation } from '@filecab/library';
import '../../styles/library-controls-shared.scss';
import './entry-editor.scss';

import { useLocalStore } from '@filecab/library';
import { Context } from '@filecab/library';
import { useContext, useLayoutEffect, useRef, type FormEvent } from 'react';
import { Category, Status } from '@filecab/contracts';
import type { EntryEditorProps } from './model-entry-editor';
import { FAILURE_MESSAGES } from '../../models/failure-messages';
import { LocalLibraryError } from '../../repository';

/** Edits one local document while keeping unsaved input after a failed or stale save. */
export function EntryEditor({ category, row, save, cancel, reload }: EntryEditorProps) {
  const { t } = useTranslation();
  const { setDirty: registerDirty } = useContext(Context);
  const form = useRef<HTMLFormElement>(null);
  const pendingNavigationSave = useRef<((saved: boolean) => void) | null>(null);
  const [{ dirty, busy, error }, { dirty: setDirty, busy: setBusy, error: setError }] =
    useLocalStore(() => ({
      dirty: false,
      busy: false,
      error: '',
    }));
  const saveForNavigation = () =>
    new Promise<boolean>((resolve) => {
      const currentForm = form.current;

      if (!currentForm || !currentForm.checkValidity()) {
        resolve(false);

        return;
      }

      pendingNavigationSave.current = resolve;
      currentForm.requestSubmit();
    });

  const draftActions = useRef({ save: saveForNavigation, discard: cancel });
  draftActions.current = { save: saveForNavigation, discard: cancel };
  useLayoutEffect(() => {
    registerDirty(
      dirty
        ? {
            save: () => draftActions.current.save(),
            discard: () => draftActions.current.discard(),
          }
        : null,
    );

    return () => registerDirty(null);
  }, [dirty, registerDirty]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (busy) return false;

    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await save(data.get('category') as Category, {
        userTitle: String(data.get('title')),
        category: data.get('category') as Category,
        status: (data.get('status') || null) as Status | null,
        rating: Number(data.get('rating')),
        progress: Number(data.get('progress')),
        comment: String(data.get('comment')),
        sourceUrls: String(data.get('sources'))
          .split('\n')
          .filter((url) => url !== ''),
      });

      return true;
    } catch (failure) {
      setError(
        failure instanceof LocalLibraryError
          ? FAILURE_MESSAGES[failure.code]
          : 'Save failed. Your input is still here; retry or reload the entry.',
      );

      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="local-editor"
      ref={form}
      onChange={() => setDirty(true)}
      onSubmit={(event) => {
        void submit(event).then((saved) => {
          const resolve = pendingNavigationSave.current;
          pendingNavigationSave.current = null;
          resolve?.(saved);
        });
      }}
    >
      <label className="local-editor__field">
        {t('Title')}
        <input
          className="local-editor__input"
          name="title"
          required
          maxLength={10000}
          defaultValue={row?.entry.userTitle ?? ''}
        />
      </label>
      <label className="local-editor__field">
        {t('Category')}
        <select
          className="local-editor__input"
          name="category"
          defaultValue={row?.entry.category ?? category}
        >
          {Object.values(Category).map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="local-editor__field">
        {t('Status')}
        <select
          className="local-editor__input"
          name="status"
          defaultValue={row?.entry.status ?? ''}
        >
          <option value="">{t('No status')}</option>
          {Object.values(Status).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="local-editor__field">
        {t('Rating')}
        <input
          className="local-editor__input"
          name="rating"
          type="number"
          min={0}
          max={10}
          step={1}
          defaultValue={row?.entry.rating ?? 0}
        />
      </label>
      <label className="local-editor__field">
        {t('Progress')}
        <input
          className="local-editor__input"
          name="progress"
          type="number"
          min={0}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          defaultValue={row?.entry.progress ?? 0}
        />
      </label>
      <label className="local-editor__field">
        {t('Comment')}
        <textarea
          className="local-editor__input"
          name="comment"
          maxLength={100000}
          defaultValue={row?.entry.comment ?? ''}
        />
      </label>
      <label className="local-editor__field">
        {t('Viewing URLs (one per line)')}
        <textarea
          className="local-editor__input"
          name="sources"
          defaultValue={row?.entry.sources.map((source) => source.originalUrl).join('\n') ?? ''}
        />
      </label>
      {error && (
        <p className="local-library__error" role="alert">
          {t(error, { defaultValue: error })}
        </p>
      )}
      {error && reload && (
        <button
          className="local-library__button"
          type="button"
          onClick={() => {
            void reload().catch(() =>
              setError('The current entry could not be loaded. Your input is still here.'),
            );
          }}
        >
          {t('Reload entry')}
        </button>
      )}
      <div className="local-library__actions">
        <button className="local-library__button" disabled={busy}>
          {t('Save locally')}
        </button>
        <button className="local-library__button" type="button" onClick={cancel}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}
