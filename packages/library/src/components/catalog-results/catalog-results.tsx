import { TitleResults } from '../title-results/title-results';
import { LibraryLayout } from '../../models/library-layout';
import { CatalogResult } from '../catalog-result/catalog-result';
import type { CatalogResultsProps } from './model-catalog-results';

/** Renders catalog and search results with one item component in either layout. */
export function CatalogResults({ records, view, columns, readOnly }: CatalogResultsProps) {
  return (
    <div className="title-results-region">
      <TitleResults
        columns={columns}
        layout={view === 'list' ? LibraryLayout.List : LibraryLayout.Grid}
      >
        {records.map((record) => (
          <CatalogResult key={record.catalogId} record={record} readOnly={readOnly} />
        ))}
      </TitleResults>
    </div>
  );
}
