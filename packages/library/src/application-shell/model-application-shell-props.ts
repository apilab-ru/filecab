import type { ReactNode } from 'react';
import type { PreferenceStorage } from '../models/interface-preferences';

/** Configures shared providers and routing around an entry point's chosen layout. */
export interface ApplicationShellProps {
  storage: PreferenceStorage;
  iconsBaseUrl?: string;
  children: ReactNode;
}
