import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Category,
  titleFor,
  type CatalogRecord,
  type CatalogSearchRequest,
  type Locale,
} from '@filecab/contracts';
import { Button, Icon, IconName } from '@filecab/ui';
import { CatalogMessages } from '../../components/catalog-messages/catalog-messages';
import { CategoryTabs } from '../../components/category-tabs/category-tabs';
import { PopupCard } from '../../components/popup-card/popup-card';
import { catalogReference } from '../../domain/catalog-client';
import { matchPage } from '../../domain/page-match';
import { useCatalogSearch } from '../../hooks/use-catalog-search';
import { catalogResultState, useCatalogSelect } from '../../hooks/use-catalog-select';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useOnline } from '../../hooks/use-online';
import { usePopupQuery } from '../../hooks/use-popup-query';
import { useWorkspace } from '../../hooks/use-workspace';
import { PageReadStatus, type PageReadResult } from '../../models/page-read';
import type { WorkspaceRow } from '../../models/workspace';
import { PAGE_RESULTS_SIZE, type PageCapturePageProps } from './model-page-capture-page';
import './page-capture-page.scss';

/**
 * Reads the active tab, then shows the entry that holds the page URL and the title search results.
 * A click on a saved card links the page to it. A save from this page adds the page URL, except for
 * a search-only page.
 */
export function PageCapturePage({ read }: PageCapturePageProps) {
  const { t } = useTranslation();
  const { origin, state, open } = useWorkspace();
  const { locale } = useInterfacePreferences();
  const online = useOnline();
  const select = useCatalogSelect();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PageReadResult | null>(null);
  const [title, setTitle] = usePopupQuery();
  const navigate = useNavigate();
  const location = useLocation();
  const { category: routeCategory } = useParams();
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

        const found = value.status === PageReadStatus.Page ? value.page : null;
        const next = new URLSearchParams(location.search);

        // A title that the user typed on Page or Search stays. Otherwise the page gives it.
        if (!title && found?.title) next.set('q', found.title);

        // One route change keeps the category for the Search tab and the title together.
        navigate(
          {
            pathname: `/page/${found?.category ?? routeCategory ?? Category.Anime}`,
            search: next.toString(),
          },
          { replace: true },
        );

        setCategory(found?.category ?? '');
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
  const request: CatalogSearchRequest = {
    category: category || Category.Anime,
    query: title,
    locale: locale as Locale,
    page: 1,
    pageSize: PAGE_RESULTS_SIZE,
  };
  // The title search always runs. The entry that holds the page URL is shown before its results.
  const searching = Boolean(result && category && title.trim());
  const search = useCatalogSearch(origin, request, retry, searching);
  const results = search.result?.results ?? [];
  const label = (row: WorkspaceRow) =>
    titleFor(row.entry.snapshot, locale, t('Untitled'), row.entry.userTitle).text;
  const edit = (row: WorkspaceRow) => open(row.entry.category, row, undefined, undefined, { link });

  // A user pick ends the automatic editor opening for this read.
  const picked = () => {
    opened.current = attempt;
  };

  // Saved entries first, then catalog records that are not one of them.
  const shown = new Set<string>();
  const rows = [match?.saved, ...(match?.candidates ?? [])].filter((row): row is WorkspaceRow => {
    if (!row || shown.has(row.entry.entryId)) return false;

    shown.add(row.entry.entryId);

    return true;
  });
  const records = [...(resolved ? [resolved] : []), ...(searching ? results : [])].filter(
    (record) => {
      const saved = catalogResultState(state.rows, record).saved;

      if (shown.has(record.catalogId) || (saved && shown.has(saved.entry.entryId))) return false;

      shown.add(record.catalogId);

      if (saved) shown.add(saved.entry.entryId);

      return true;
    },
  );
  const cards = [
    ...rows.map((row) => (
      <PopupCard key={row.entry.entryId} row={row} link={link} onPick={picked} />
    )),
    ...records.map((record) => (
      <PopupCard key={record.catalogId} record={record} link={link} onPick={picked} />
    )),
  ];

  // Open the editor one time for each page read for a title that is not in the library yet: the
  // referenced record or the only search result. An entry that is already saved opens only after
  // a click on its card. A conflict never opens an editor.
  useEffect(() => {
    if (!result || !state.repository || opened.current === attempt || match?.conflict.length)
      return;

    const target = resolved ?? (results.length === 1 ? results[0]! : null);

    if (match?.saved || (target && catalogResultState(state.rows, target).saved)) {
      opened.current = attempt;
    } else if (target && select(target, link)) {
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
          <Button onClick={() => setAttempt((value) => value + 1)}>{t('retry')}</Button>
        </p>
      )}
      <CategoryTabs
        value={category}
        onChange={(value) => {
          setCategory(value);
          navigate({ pathname: `/page/${value}`, search: location.search }, { replace: true });
        }}
      />
      {!category && <p className="page-capture__status">{t('chooseCategory')}</p>}
      <input
        className="page-capture__input"
        aria-label={t('popupSearchQuery')}
        placeholder={t('popupSearchQuery')}
        value={title}
        maxLength={300}
        onChange={(event) => setTitle(event.target.value)}
      />
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
      {cards.length > 0 && (
        <ul className="page-capture__results" aria-label={t('popupSearchResults')}>
          {cards}
        </ul>
      )}
      {searching && (
        <>
          <CatalogMessages
            search={search}
            online={online}
            hideEmpty={cards.length > 0}
            onRetry={() => setRetry((value) => value + 1)}
          />
          {search.loading && online && (
            <p className="page-capture__status" role="status">
              {t('catalogLoading')}
            </p>
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
        <Icon name={IconName.Plus} />
        {t('Add manual entry')}
      </Button>
    </section>
  );
}
