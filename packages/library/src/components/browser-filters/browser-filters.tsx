import { Button, Icon, IconName, Select } from '@filecab/ui';
import { useTranslation } from 'react-i18next';
import type { BrowserFiltersProps } from './model-browser-filters';
import './browser-filters.scss';

/** Renders the same toolbar for library and catalog filter configurations. */
export function BrowserFilters({
  query,
  queryLabel,
  onQueryChange,
  filters,
  disabled,
  onAdd,
}: BrowserFiltersProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="library-browser__toolbar" disabled={disabled}>
      <label className="library-browser__search">
        <Icon name={IconName.Search} />
        <input
          className="library-browser__search-input"
          type="search"
          aria-label={queryLabel}
          placeholder={queryLabel}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {filters.map((filter) =>
        filter.options ? (
          <Select
            key={filter.key}
            className="library-browser__filter"
            aria-label={filter.label}
            placeholder={filter.label}
            value={filter.value}
            disabled={filter.disabled}
            options={filter.options}
            onValueChange={filter.onChange}
          />
        ) : (
          <input
            key={filter.key}
            className="library-browser__filter"
            aria-label={filter.label}
            placeholder={filter.label}
            inputMode="numeric"
            value={filter.value ?? ''}
            disabled={filter.disabled}
            onChange={(event) => filter.onChange(event.target.value)}
          />
        ),
      )}
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
