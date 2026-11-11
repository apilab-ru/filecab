import { createStore } from 'zustand/vanilla';
import type { LocalStore, LocalStateSetters } from '../models/local-store';

/** Creates isolated local values and stable field update actions. */
export function createLocalStore<State extends object>(initialize: () => State) {
  return createStore<LocalStore<State>>((set) => {
    const values = initialize();
    const setters = Object.fromEntries(
      Object.keys(values).map((key) => [
        key,
        (next: unknown) => {
          set((store) => {
            const field = key as keyof State;
            const previous = store.values[field];
            const value = typeof next === 'function' ? next(previous) : next;

            if (Object.is(previous, value)) return store;

            return { values: { ...store.values, [key]: value } };
          });
        },
      ]),
    ) as LocalStateSetters<State>;

    return { values, setters };
  });
}
