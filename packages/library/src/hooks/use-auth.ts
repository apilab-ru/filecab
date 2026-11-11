import { useContext, useSyncExternalStore } from 'react';
import { AuthContext } from '../models/auth-context';

/** Reads live authentication state and operations from the nearest application provider. */
export function useAuth() {
  const repository = useContext(AuthContext);

  if (!repository) throw new Error('useAuth must be used inside AuthProvider.');

  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );

  return {
    ...state,
    signIn: repository.signIn,
    signOut: repository.signOut,
    signOutAll: repository.signOutAll,
  };
}
