import { useContext } from 'react';
import { WorkspaceContext } from '../models/workspace';

/** Reads the shared catalog and editor workspace from the current application shell. */
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);

  if (!workspace) throw new Error('Workspace provider is missing');

  return workspace;
}
