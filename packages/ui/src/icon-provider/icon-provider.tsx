import { IconBase } from '../models/icon-context';
import type { IconProviderProps } from './model-icon-provider';

/** Selects packaged extension SVGs while allowing the website to bundle shared copies. */
export function IconProvider({ baseUrl, children }: IconProviderProps) {
  return <IconBase.Provider value={baseUrl}>{children}</IconBase.Provider>;
}
