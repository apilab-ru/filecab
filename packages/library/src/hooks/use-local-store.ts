import { useRef } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { createLocalStore } from './create-local-store';
import type { LocalStore } from '../models/local-store';

/** Owns one Zustand store per mounted component with stable field update actions. */
export function useLocalStore<State extends object>(initialize: () => State) {
  const reference = useRef<StoreApi<LocalStore<State>> | null>(null);

  if (!reference.current) {
    reference.current = createLocalStore(initialize);
  }

  const store = useStore(reference.current);

  return [store.values, store.setters] as const;
}
