import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Category,
  titleFor,
  type CatalogRecord,
  type CatalogSearchRequest,
  type Locale,
} from '@filecab/contracts';
import { Button } from '@filecab/ui';
import { CatalogMessages } from '../../components/catalog-messages/catalog-messages';
import { CompactResult } from '../../components/compact-result/compact-result';
import { catalogReference } from '../../domain/catalog-client';
import { matchPage } from '../../domain/page-match';
import { useCatalogSearch } from '../../hooks/use-catalog-search';
import { useCatalogSelect } from '../../hooks/use-catalog-select';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useOnline } from '../../hooks/use-online';
import { useWorkspace } from '../../hooks/use-workspace';
import { PageReadStatus, type PageReadResult } from '../../models/page-read';
import type { WorkspaceRow } from '../../models/workspace';
import { PAGE_RESULTS_SIZE, type PageCapturePageProps } from './model-page-capture-page';
import './page-capture-page.scss';

/**
 * Reads the active tab, then offers the saved entry, a catalog match or manual creation.
 * A save from this page adds the page URL, except for a search-only page.
 */
export function PageCapturePage({ read }: PageCapturePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { origin, state, open } = useWorkspace();
  const { locale } = useInterfacePreferences();
  const online = useOnline();
  const select = useCatalogSelect();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PageReadResult | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [resolved, setResolved] = useState<CatalogRecord | null>(null);
  const [retry, setRetry] = useState(0);
  const opened = useRef(-1);
  const page = result?.status === PageReadStatus.Page ? result.page : null;
  const link = page && !page.searchOnly ? page.url : undefined;

  useEffect(() => {
    let active = true;
    setResult(null);
    setResolved(null);
    read()
      .catch((): PageReadResult => ({ status: PageReadStatus.Failed }))
      .then((value) => {
        if (!active) return;

        setResult(value);
        setTitle(value.status === PageReadStatus.Page ? value.page.title : '');
        setCategory(value.status === PageReadStatus.Page ? (value.page.category ?? '') : '');
      });

    return () => {
      active = false;
    };
  }, [read, attempt]);

  // A provider reference opens its catalog record directly, without a title search.
  useEffect(() => {
    if (!page?.references.length) return;

    const controller = new AbortController();
    void (async () => {
      for (const reference of page.references) {
        try {
          const record = await catalogReference(
            origin,
            reference,
            locale as Locale,
            controller.signal,
          );

          if (!controller.signal.aborted) setResolved(record);

          return;
        } catch {
          // Try the next reference. A failed lookup falls back to the title search.
        }
      }
    })();

    return () => controller.abort();
  }, [page, origin, locale]);

  const match = page
    ? matchPage(state.rows, page, title, category || null, locale as Locale)
    : null;
  const identified = Boolean(match?.saved || match?.conflict.length || resolved);
  const request: CatalogSearchRequest = {
    category: category || Category.Anime,
    query: title,
    locale: locale as Locale,
    page: 1,
    pageSize: PAGE_RESULTS_SIZE,
  };
  const searching = Boolean(result && category && title.trim() && !identified);
  const search = useCatalogSearch(origin, request, retry, searching);
  const results = search.result?.results ?? [];
  const label = (row: WorkspaceRow) =>
    titleFor(row.entry.snapshot, locale, t('Untitled'), row.entry.userTitle).text;
  const edit = (row: WorkspaceRow) => open(row.entry.category, row, undefined, undefined, { link });

  // Open the editor one time for each page read: the saved entry, the referenced record or
  // the only search result. A conflict never opens an editor.
  useEffect(() => {
    if (!result || !state.repository || opened.current === attempt || match?.conflict.length)
      return;

    if (match?.saved) {
      opened.current = attempt;
      edit(match.saved);
    } else if (resolved) {
      if (select(resolved, link)) opened.current = attempt;
    } else if (results.length === 1 && select(results[0]!, link)) {
      opened.current = attempt;
    }
  }, [
    result,
    match?.saved,
    match?.conflict.length,
    resolved,
    search.result,
    state.repository,
    select,
  ]);

  if (!result)
    return (
      <p className="page-capture__status" role="status">
        {t('pageReading')}
      </p>
    );

  return (
    <section className="page-capture" aria-label={t('page')}>
      {result.status !== PageReadStatus.Page && (
        <p className="page-capture__message" role="alert">
          {t(result.status === PageReadStatus.Restricted ? 'pageRestricted' : 'pageReadFailed')}{' '}
          <Button onClick={() => setAttempt((value) => value + 1)}>{t('retry')}</Button>{' '}
          <Button onClick={() => navigate(`/search/${category || Category.Anime}`)}>
            {t('search')}
          </Button>
        </p>
      )}
      <div className="page-capture__controls">
        <label className="page-capture__field">
          {t('Category')}
          <select
            className="page-capture__input"
            value={category}
            onChange={(event) => setCategory(event.target.value as Category | '')}
          >
            {!category && <option value="">{t('chooseCategory')}</option>}
            {Object.values(Category).map((value) => (
              <option key={value} value={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="page-capture__field">
          {t('popupSearchQuery')}
          <input
            className="page-capture__input"
            value={title}
            maxLength={300}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      </div>
      {match?.conflict.length ? (
        <div className="page-capture__message" role="alert">
          <p className="page-capture__text">{t('pageConflict')}</p>
          {match.conflict.map((row) => (
            <Button key={row.entry.entryId} onClick={() => edit(row)}>
              {t('pageEdit', { title: label(row) })}
            </Button>
          ))}
        </div>
      ) : null}
      {match?.saved && (
        <Button className="page-capture__saved" onClick={() => edit(match.saved!)}>
          {t('pageEdit', { title: label(match.saved) })}
        </Button>
      )}
      {match?.candidates.map((row) => (
        <Button key={row.entry.entryId} onClick={() => edit(row)}>
          {t('pageSuggestion', { title: label(row) })}
        </Button>
      ))}
      {resolved && (
        <ul className="page-capture__results" aria-label={t('popupSearchResults')}>
          <CompactResult record={resolved} link={link} />
        </ul>
      )}
      {searching && (
        <>
          <CatalogMessages
            search={search}
            online={online}
            onRetry={() => setRetry((value) => value + 1)}
          />
          {search.loading && online && (
            <p className="page-capture__status" role="status">
              {t('catalogLoading')}
            </p>
          )}
          {results.length > 0 && (
            <ul className="page-capture__results" aria-label={t('popupSearchResults')}>
              {results.map((record) => (
                <CompactResult key={record.catalogId} record={record} link={link} />
              ))}
            </ul>
          )}
        </>
      )}
      <Button
        className="page-capture__manual"
        disabled={!category || !title.trim() || !state.repository}
        onClick={() =>
          open(category as Category, undefined, undefined, undefined, { link, title: title.trim() })
        }
      >
        {t('Add manual entry')}
      </Button>
    </section>
  );
}
