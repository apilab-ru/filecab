import { createContext } from 'react';
import type { ReactNode } from 'react';

/** Supplies composed application content to the persistent router's route element. */
export const ApplicationShellContentContext = createContext<ReactNode>(null);
