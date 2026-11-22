import type { ReactNode } from 'react';
import type { PreferenceStorage } from '../../models/interface-preferences';
import type { RouterMode } from '../../models/router-mode';

/** Configures shared providers and routing around an entry point's chosen layout. */
export interface ApplicationShellProps {
  storage: PreferenceStorage;
  iconsBaseUrl?: string;
  /** The website uses path routes. Extension pages use hash routes. */
  routerMode: RouterMode;
  children: ReactNode;
}
