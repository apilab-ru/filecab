import { useTranslation } from 'react-i18next';
import { Select } from '@filecab/ui';
import '../../styles/library-browser-shared.scss';
import '../../styles/library-pagination.scss';
import type { SortControlsProps } from './model-sort-controls';

/** Renders the Sort by and Order selects of a pagination panel. */
export function SortControls<Field extends string, Direction extends string>({
  field,
  fields,
  fieldPlaceholder,
  direction,
  directions,
  fieldDisabled,
  directionDisabled,
  onFieldChange,
  onDirectionChange,
}: SortControlsProps<Field, Direction>) {
  const { t } = useTranslation();

  return (
    <>
      <label className="library-browser__ordering">
        <span>{t('sortBy')}</span>
        <Select<Field | null>
          className="library-browser__select"
          aria-label={t('sortBy')}
          placeholder={fieldPlaceholder}
          value={field}
          disabled={fieldDisabled}
          onValueChange={(value) => {
            if (value !== null) onFieldChange(value);
          }}
          options={fields}
        />
      </label>
      <label className="library-browser__ordering">
        <span>{t('order')}</span>
        <Select<Direction | null>
          className="library-browser__select"
          aria-label={t('order')}
          placeholder={t('order')}
          value={direction || null}
          disabled={directionDisabled}
          onValueChange={(value) => {
            if (value !== null) onDirectionChange(value);
          }}
          options={directions}
        />
      </label>
    </>
  );
}
