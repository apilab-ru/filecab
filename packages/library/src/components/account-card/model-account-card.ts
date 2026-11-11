import type { ReactNode } from 'react';

export interface AccountCardProps {
  signedIn: boolean;
  busy: boolean;
  signIn: () => void;
  signOut: () => void;
  signOutAll: () => void;
  children?: ReactNode;
}
