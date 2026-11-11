import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useTranslation } from 'react-i18next';
import '../../styles/library-browser-shared.scss';
import './library-browser-filters.scss';

import { genreLabelFor, Status } from '@filecab/contracts';
import { Button, Icon, IconName, Select } from '@filecab/ui';
import { LibraryLayout } from '../../models/library-layout';
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
      <Select
        className="library-browser__select"
        aria-label={t('Status')}
        disabled={!available}
        value={status}
        onValueChange={onStatusChange}
        placeholder={t('Status')}
        options={[
          { value: null, label: 'All' },
          ...Object.values(Status).map((value) => ({ value, label: t(value) })),
        ]}
      />
      <Select
        className="library-browser__select"
        aria-label={t('Rating')}
        disabled={!available}
        value={rating}
        onValueChange={(value) => onRatingChange(value === null ? '' : String(value))}
        placeholder={t('Rating')}
        options={[
          { value: '', label: t('Rating') },
          ...RATING_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
        ]}
      />
      <Select
        className="library-browser__select"
        aria-label={t('genres')}
        disabled={!available}
        value={genre}
        onValueChange={(value) => onGenreChange(value === null ? '' : String(value))}
        placeholder={t('genres')}
        options={[
          { value: '', label: t('genres') },
          ...genres.map((item) => ({
            value: String(item.genreId),
            label: genreLabelFor(item, locale).text,
          })),
        ]}
      />
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
