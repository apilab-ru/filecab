import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import type { DraftActions } from '../models/interface-context';
import { useLocalStore } from './use-local-store';

/** Guards route changes and window unloads until the current draft is resolved. */
export function useDraftGuard() {
  const [{ draft }, { draft: setDirty }] = useLocalStore(() => ({
    draft: null as DraftActions | null,
  }));
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      Boolean(draft) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash),
  );

  useEffect(() => {
    if (!draft) return;

    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);

    return () => window.removeEventListener('beforeunload', unload);
  }, [draft]);

  return {
    setDirty,
    confirmation: {
      open: blocker.state === 'blocked',
      onOpenChange: (open: boolean) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      },
      onSave: async () => {
        if (blocker.state !== 'blocked' || !draft) return;

        try {
          if (await draft.save()) blocker.proceed();
          else blocker.reset();
        } catch {
          blocker.reset();
        }
      },
      onDiscard: () => {
        if (blocker.state !== 'blocked') return;

        draft?.discard();
        setDirty(null);
        blocker.proceed();
      },
      onContinueEditing: () => {
        if (blocker.state === 'blocked') blocker.reset();
      },
    },
  };
}
