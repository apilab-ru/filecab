import type { ReactNode } from 'react';

/** Supplies popup assets, links, and the persistent data adapter. */
export interface PopupProps {
  fullPageUrl?: string;
  iconUrl?: string;
  children?: ReactNode;
}
