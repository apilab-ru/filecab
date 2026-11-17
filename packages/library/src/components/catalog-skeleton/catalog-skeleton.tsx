import { useTranslation } from 'react-i18next';
import { TitleResults } from '../title-results/title-results';
import type { CatalogSkeletonProps } from './model-catalog-skeleton';
import './catalog-skeleton.scss';

const PLACEHOLDERS = Array.from({ length: 12 }, (_, index) => index);

/** Reserves catalog result geometry while the current request is pending. */
export function CatalogSkeleton({ layout }: CatalogSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div className="title-results-region" aria-busy="true">
      <div aria-hidden="true">
        <TitleResults
          layout={layout}
          columns={[
            { key: 'title', label: t('Title') },
            { key: 'year', label: t('year') },
            { key: 'status', label: t('Status') },
            { key: 'episodes', label: t('episodes') },
            { key: 'rating', label: t('Rating') },
          ]}
        >
          {PLACEHOLDERS.map((index) => (
            <li key={index} className="catalog-skeleton">
              <div className="catalog-skeleton__cover" />
              <div className="catalog-skeleton__body">
                <span className="catalog-skeleton__line catalog-skeleton__title" />
                <span className="catalog-skeleton__line catalog-skeleton__year" />
                <span className="catalog-skeleton__line catalog-skeleton__status" />
                <span className="catalog-skeleton__line catalog-skeleton__progress" />
                <span className="catalog-skeleton__line catalog-skeleton__rating" />
              </div>
            </li>
          ))}
        </TitleResults>
      </div>
    </div>
  );
}
