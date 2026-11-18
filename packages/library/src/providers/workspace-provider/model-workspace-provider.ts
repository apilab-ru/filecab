import type { ReactNode } from 'react';

/** Supplies the public backend origin and persistent application layouts. */
export interface WorkspaceProviderProps {
  origin: string;
  children: ReactNode;
}
