import { useContext } from 'react';
import { InterfacePreferencesContext } from '../models/interface-preferences';

/** Reads the single live preference state supplied by the application shell. */
export function useInterfacePreferences() {
  const preferences = useContext(InterfacePreferencesContext);

  if (!preferences) throw new Error('Interface preferences must be provided by ApplicationShell.');

  return preferences;
}
