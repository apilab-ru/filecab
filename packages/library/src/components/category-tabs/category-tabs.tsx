import { useTranslation } from 'react-i18next';
import { Category } from '@filecab/contracts';
import type { CategoryTabsProps } from './model-category-tabs';
import './category-tabs.scss';

/** Shows the popup category tabs: Anime, Films and TV series. */
export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  const { t } = useTranslation();

  return (
    <nav className="category-tabs" aria-label={t('Category')}>
      {Object.values(Category).map((category) => (
        <button
          key={category}
          type="button"
          className="category-tabs__tab"
          aria-pressed={value === category}
          onClick={() => onChange(category)}
        >
          {t(category)}
        </button>
      ))}
    </nav>
  );
}
