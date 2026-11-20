import { useContext } from 'react';
import { ApplicationShellContentContext } from '../../models/application-shell-content-context';

export { LibraryMode, Theme, websitePreferences } from '../../models/preferences';
export type { InterfacePreferences, PreferenceStorage } from '../../models/preferences';
export { browserLocale } from '../../i18n/browser-locale';

/** Renders the entry point's composed layout inside the router. */
export function ApplicationShellContent() {
  return useContext(ApplicationShellContentContext);
}
