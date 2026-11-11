import type { Category } from '@filecab/contracts';
import type { ReactNode } from 'react';

/** Supplies full-page assets and the persistent library adapter. */
export interface FullPageProps {
  iconUrl?: string;
  children?: ReactNode;
  renderLibrary?: (category: Category) => ReactNode;
}
