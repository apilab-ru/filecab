import { useInterfacePreferences } from '../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import '../styles/library-browser-shared.scss';
import './library-browser-filters.scss';

import { genreLabelFor, Status } from '@filecab/contracts';
import { Button, Icon, IconName } from '@filecab/ui';
import { LibraryLayout } from '../models/library-layout';
import { RATING_OPTIONS } from '../library-browser/model-library-browser';
import type { LibraryBrowserFiltersProps } from './model-library-browser-filters';

/** Renders the library search, filters, view switch and add action. */
export function LibraryBrowserFilters({
  query,
  status,
  rating,
  genre,
  genres,
  layout,
  available,
  onQueryChange,
  onStatusChange,
  onRatingChange,
  onGenreChange,
  onLayoutChange,
  onAdd,
}: LibraryBrowserFiltersProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();

  return (
    <fieldset className="library-browser__toolbar" disabled={!available}>
      <label className="library-browser__search">
        <Icon name={IconName.Search} />
        <input
          className="library-browser__search-input"
          aria-label={t('searchLibrary')}
          placeholder={t('searchLibrary')}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <select
        className="library-browser__select"
        aria-label={t('Status')}
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
      >
        <option value="">{t('Status')}</option>
        {Object.values(Status).map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
      <select
        className="library-browser__select"
        aria-label={t('Rating')}
        value={rating}
        onChange={(event) => onRatingChange(event.target.value)}
      >
        <option value="">{t('Rating')}</option>
        {RATING_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {value}+
          </option>
        ))}
      </select>
      <select
        className="library-browser__select"
        aria-label={t('genres')}
        value={genre}
        onChange={(event) => onGenreChange(event.target.value)}
      >
        <option value="">{t('genres')}</option>
        {genres.map((item) => (
          <option key={item.genreId} value={item.genreId}>
            {genreLabelFor(item, locale).text}
          </option>
        ))}
      </select>
      <div className="library-browser__views">
        <Button
          aria-label={t('listView')}
          aria-pressed={layout === LibraryLayout.List}
          onClick={() => onLayoutChange(LibraryLayout.List)}
        >
          <Icon name={IconName.List} />
        </Button>
        <Button
          aria-label={t('gridView')}
          aria-pressed={layout === LibraryLayout.Grid}
          onClick={() => onLayoutChange(LibraryLayout.Grid)}
        >
          <Icon name={IconName.Grid} />
        </Button>
      </div>
      {onAdd && (
        <Button
          className="fc-button--primary library-browser__add"
          aria-label={t('Add manual entry')}
          onClick={onAdd}
        >
          <Icon name={IconName.Plus} />
          {t('addTitle')}
        </Button>
      )}
    </fieldset>
  );
}
