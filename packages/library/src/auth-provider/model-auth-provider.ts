import type { ReactNode } from 'react';
import type { AuthRepository } from '../models/auth-repository';

/** Supplies the application authentication implementation to shared controls. */
export interface AuthProviderProps {
  repository: AuthRepository;
  children: ReactNode;
}
