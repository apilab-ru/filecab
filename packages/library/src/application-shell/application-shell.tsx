import { useMemo } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { IconProvider } from '@filecab/ui';
import { ApplicationShellContent } from '../application-shell-content/application-shell-content';
import type { ApplicationShellProps } from './model-application-shell-props';
import { InterfacePreferencesProvider } from '../interface-preferences-provider/interface-preferences-provider';
import { ApplicationShellContentContext } from '../models/application-shell-content-context';
import { SyncSettingsProvider } from '../sync-settings-provider/sync-settings-provider';

export { useDraftGuard } from '../hooks/use-draft-guard';
export { Context } from '../models/interface-context';
export { LibraryMode, Theme, websitePreferences } from '../preferences';
export type { InterfacePreferences, PreferenceStorage } from '../preferences';
export { browserLocale } from '../i18n/browser-locale';

/** Provides data-router hash routing for the shared application shell. */
export function ApplicationShell({
  storage: preferenceStorage,
  iconsBaseUrl,
  children,
}: ApplicationShellProps) {
  const router = useMemo(
    () => createHashRouter([{ path: '*', element: <ApplicationShellContent /> }]),
    [],
  );

  return (
    <ApplicationShellContentContext.Provider value={children}>
      <InterfacePreferencesProvider storage={preferenceStorage}>
        <SyncSettingsProvider>
          <IconProvider baseUrl={iconsBaseUrl}>
            <RouterProvider router={router} />
          </IconProvider>
        </SyncSettingsProvider>
      </InterfacePreferencesProvider>
    </ApplicationShellContentContext.Provider>
  );
}
