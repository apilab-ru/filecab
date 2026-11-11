import { createContext } from 'react';
import type { AuthRepository } from './auth-repository';

export const AuthContext = createContext<AuthRepository | null>(null);
