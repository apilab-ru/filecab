import { useMemo } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider } from 'react-router-dom';
import { IconProvider } from '@filecab/ui';
import { ApplicationShellContent } from '../application-shell-content/application-shell-content';
import type { ApplicationShellProps } from './model-application-shell-props';
import { InterfacePreferencesProvider } from '../../providers/interface-preferences-provider/interface-preferences-provider';
import { ApplicationShellContentContext } from '../../models/application-shell-content-context';
import { SyncSettingsProvider } from '../../providers/sync-settings-provider/sync-settings-provider';
import { RouterMode } from '../../models/router-mode';

export { LibraryMode, Theme, websitePreferences } from '../../models/preferences';
export type { InterfacePreferences, PreferenceStorage } from '../../models/preferences';
export { browserLocale } from '../../i18n/browser-locale';

/** Creates the data router for each router mode. */
const ROUTER_FACTORIES = {
  [RouterMode.Browser]: createBrowserRouter,
  [RouterMode.Hash]: createHashRouter,
};

/** Provides data-router routing for the shared application shell. */
export function ApplicationShell({
  storage: preferenceStorage,
  iconsBaseUrl,
  routerMode,
  children,
}: ApplicationShellProps) {
  const router = useMemo(
    () => ROUTER_FACTORIES[routerMode]([{ path: '*', element: <ApplicationShellContent /> }]),
    [routerMode],
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
