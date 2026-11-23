import type { Category } from '@filecab/contracts';
import type { ReactNode } from 'react';

/** Supplies full-page assets and the persistent library adapter. */
export interface FullPageProps {
  iconUrl?: string;
  children?: ReactNode;
  renderLibrary?: (category: Category) => ReactNode;
  /** Renders the public library of `/u/:username`. Without it, the route is not available. */
  renderPublicLibrary?: (username: string, category: Category) => ReactNode;
}
