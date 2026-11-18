import { genreLabelFor, Status } from '@filecab/contracts';
import { useTranslation } from 'react-i18next';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { RATING_OPTIONS } from '../library-browser/model-library-browser';
import { BrowserFilters } from '../browser-filters/browser-filters';
import type { LibraryBrowserFiltersProps } from './model-library-browser-filters';

/** Configures the shared toolbar for private library filters. */
export function LibraryBrowserFilters({
  query,
  status,
  rating,
  genre,
  genres,
  available,
  onQueryChange,
  onStatusChange,
  onRatingChange,
  onGenreChange,
  onAdd,
}: LibraryBrowserFiltersProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();

  return (
    <BrowserFilters
      query={query}
      queryLabel={t('searchLibrary')}
      onQueryChange={onQueryChange}
      disabled={!available}
      onAdd={onAdd}
      filters={[
        {
          key: 'status',
          label: t('Status'),
          value: status,
          onChange: onStatusChange,
          options: [
            { value: null, label: t('Status') },
            ...Object.values(Status).map((value) => ({ value, label: t(value) })),
          ],
        },
        {
          key: 'rating',
          label: t('Rating'),
          value: rating,
          onChange: (value) => onRatingChange(value ?? ''),
          options: [
            { value: '', label: t('Rating') },
            ...RATING_OPTIONS.map((value) => ({ value: String(value), label: `${value}+` })),
          ],
        },
        {
          key: 'genre',
          label: t('genres'),
          value: genre,
          onChange: (value) => onGenreChange(value ?? ''),
          options: [
            { value: '', label: t('genres') },
            ...genres.map((item) => ({
              value: item.genreId,
              label: genreLabelFor(item, locale).text,
            })),
          ],
        },
      ]}
    />
  );
}
