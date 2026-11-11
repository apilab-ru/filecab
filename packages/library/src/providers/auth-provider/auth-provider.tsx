import { AuthContext } from '../../models/auth-context';
import type { AuthProviderProps } from './model-auth-provider';

/** Makes application authentication available without passing UI through the shell. */
export function AuthProvider({ repository, children }: AuthProviderProps) {
  return <AuthContext.Provider value={repository}>{children}</AuthContext.Provider>;
}
