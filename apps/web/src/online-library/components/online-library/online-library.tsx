import { useTranslation, useInterfacePreferences } from '@filecab/library';
import './online-library.scss';

import { useWorkspace } from '@filecab/library';
import { onlineWorkspaceRepository } from '../../workspace-repository';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OwnerSnapshot } from '@filecab/contracts';
import { LibraryBrowser, useSyncSettings } from '@filecab/library';
import type { LibraryContentProps } from '@filecab/library';
import { Button } from '@filecab/ui';
import { API_ORIGIN, currentAccount } from '../../../auth/session';

/** Reads the complete owner snapshot online without creating a second local library. */
export function OnlineLibrary({ category }: LibraryContentProps) {
  const { t } = useTranslation();
  const workspace = useWorkspace();
  const { locale } = useInterfacePreferences();
  const { setSyncSettings } = useSyncSettings();
  const account = useQuery({
    queryKey: ['account'],
    queryFn: ({ signal }) => currentAccount(signal),
  });
  const library = useQuery({
    queryKey: ['library', account.data?.ownerId],
    enabled: !!account.data,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${API_ORIGIN}/api/v1/library`, {
        credentials: 'include',
        signal,
      });

      if (!response.ok) throw new Error('Library unavailable');

      return (await response.json()) as OwnerSnapshot;
    },
  });

  const adapter = useMemo(
    () => (account.data ? onlineWorkspaceRepository(account.data.ownerId) : null),
    [account.data?.ownerId],
  );
  useEffect(() => {
    workspace.register({
      scope: `website:${account.data?.ownerId ?? 'guest'}`,
      rows: library.data?.entries.map((entry) => ({ entry, version: entry.serverVersion })) ?? [],
      repository: library.data ? adapter : null,
    });
  }, [account.data?.ownerId, library.data, adapter, workspace.register]);

  useEffect(() => {
    let description: string = t('syncSignIn');

    if (account.data) description = t('onlineRefresh');

    if (library.error) description = t('libraryLoadFailed');

    setSyncSettings({
      enabled: !!account.data,
      working: library.isFetching,
      online: true,
      lastSuccess: library.dataUpdatedAt || null,
      message: description,
      refresh: () => {
        void library.refetch();
      },
    });

    return () => setSyncSettings(null);
  }, [
    setSyncSettings,
    account.data?.ownerId,
    library.isFetching,
    library.dataUpdatedAt,
    library.error,
    locale,
    t,
  ]);

  return (
    <>
      <LibraryBrowser
        category={category}
        key={`${account.data?.ownerId ?? 'guest'}:${category}`}
        entries={library.data?.entries ?? []}
        available={!!library.data}
        onAdd={library.data ? () => workspace.open(category) : undefined}
        onEdit={
          library.data
            ? (entry) => workspace.open(category, { entry, version: entry.serverVersion! })
            : undefined
        }
      />
      {!account.data && !account.isPending && (
        <p className="online-library__message">{t('signInLibrary')}</p>
      )}
      {account.isPending || (account.data && library.isPending) ? (
        <p className="online-library__message" role="status">
          {t('loadingLibrary')}
        </p>
      ) : null}
      {library.error && (
        <div className="online-library__message" role="alert">
          <p>{t('libraryLoadFailed')}</p>
          <Button
            onClick={() => {
              void library.refetch();
            }}
          >
            {t('retry')}
          </Button>
        </div>
      )}
    </>
  );
}
