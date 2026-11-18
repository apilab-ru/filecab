import { useTranslation } from 'react-i18next';
import { LibraryLayout } from '../../models/library-layout';
import { SortDirection } from '../../models/sort-direction';
import {
  OPPOSITE_DIRECTION,
  SORT_ARROWS,
  SORT_TITLE_KEYS,
  type TitleColumn,
  type TitleResultsProps,
} from './model-title-results';
import './title-results.scss';

/** Selects the next supported sort direction for a column. */
function nextDirection(column: TitleColumn) {
  const directions = column.directions ?? [];
  const next = column.direction ? OPPOSITE_DIRECTION[column.direction] : SortDirection.Asc;

  return directions.find((direction) => direction === next) ?? directions[0] ?? SortDirection.Asc;
}

/** Renders the shared title grid or compact list with supported column ordering. */
export function TitleResults({ layout, children, columns = [] }: TitleResultsProps) {
  const { t } = useTranslation();

  return (
    <div className={`title-collection title-collection--${layout}`}>
      {layout === LibraryLayout.List && (
        <div className="title-collection__header">
          {columns.map((column) => (
            <div
              key={column.key}
              className={`title-collection__column title-collection__column--${column.key}`}
            >
              {column.onSort && column.directions?.length ? (
                <button
                  type="button"
                  className="title-collection__sort"
                  aria-label={column.label}
                  aria-pressed={Boolean(column.direction)}
                  title={t(SORT_TITLE_KEYS[nextDirection(column)], { column: column.label })}
                  onClick={() => column.onSort?.(nextDirection(column))}
                >
                  {column.label}
                  <span className="title-collection__arrows" aria-hidden="true">
                    {column.directions.map((direction) => (
                      <span
                        key={direction}
                        className={
                          column.direction === direction ? 'title-collection__arrow--active' : ''
                        }
                      >
                        {SORT_ARROWS[direction]}
                      </span>
                    ))}
                  </span>
                </button>
              ) : (
                <span>{column.label}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <ul
        className={`title-results title-results--${layout} library-browser__entries library-browser__entries--${layout}`}
      >
        {children}
      </ul>
    </div>
  );
}
