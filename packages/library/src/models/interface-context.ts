import { createContext } from 'react';

/** Registers the current editor's save/discard actions without coupling UI to persistence. */
export interface DraftActions {
  save: () => Promise<boolean>;
  discard: () => void;
}

/** Shares interface state independently of client data and authentication adapters. */
export interface InterfaceContext {
  setDirty: (actions: DraftActions | null) => void;
}

const DEFAULT_INTERFACE_CONTEXT: InterfaceContext = {
  setDirty: () => undefined,
};

export const Context = createContext<InterfaceContext>(DEFAULT_INTERFACE_CONTEXT);
