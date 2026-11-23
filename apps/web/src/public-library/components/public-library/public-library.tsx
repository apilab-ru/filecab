import './public-library.scss';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Category, Entry, PublicLibrary as PublicLibraryData } from '@filecab/contracts';
import { LibraryBrowser, useTranslation } from '@filecab/library';
import { Button } from '@filecab/ui';
import { API_ORIGIN } from '../../../auth/session';
import type { PublicLibraryProps } from './model-public-library';

/** Marks a public library that does not exist or is not public. */
class PublicLibraryNotFoundError extends Error {}

/** Reads a public library anonymously. Cookies are not sent. */
async function readPublicLibrary(
  username: string,
  signal: AbortSignal,
): Promise<PublicLibraryData> {
  const response = await fetch(
    `${API_ORIGIN}/api/v1/public/libraries/${encodeURIComponent(username)}`,
    { credentials: 'omit', signal },
  );

  if (response.status === 404) throw new PublicLibraryNotFoundError();

  if (!response.ok) throw new Error('Public library unavailable');

  return (await response.json()) as PublicLibraryData;
}

/** Shows the read-only public library of a username, without any owner data or actions. */
export function PublicLibrary({ username, category }: PublicLibraryProps) {
  const { t } = useTranslation();
  const library = useQuery({
    queryKey: ['public-library', username.toLowerCase()],
    queryFn: ({ signal }) => readPublicLibrary(username, signal),
    retry: (count, error) => !(error instanceof PublicLibraryNotFoundError) && count < 2,
  });
  // The browser needs entry identities. Positions stand in for the hidden entry UUIDs.
  const entries = useMemo<Entry[]>(
    () =>
      library.data?.entries.map((entry, index) => ({
        ...entry,
        schemaVersion: 1,
        entryId: `public-${index}`,
        catalogId: null,
        comment: '',
        sources: [],
        serverVersion: null,
        deleted: false,
      })) ?? [],
    [library.data],
  );

  return (
    <section className="public-library" aria-labelledby="public-library-heading">
      {library.isPending && (
        <p className="public-library__message" role="status">
          {t('publicLibraryLoading')}
        </p>
      )}
      {library.error instanceof PublicLibraryNotFoundError && (
        <p className="public-library__message" role="alert">
          {t('publicLibraryNotFound')}
        </p>
      )}
      {library.isError && !(library.error instanceof PublicLibraryNotFoundError) && (
        <div className="public-library__message" role="alert">
          <p>{t('publicLibraryLoadFailed')}</p>
          <Button onClick={() => void library.refetch()}>{t('retry')}</Button>
        </div>
      )}
      {library.data && <LibraryBrowser category={category as Category} readOnlyEntries={entries} />}
    </section>
  );
}
