import { authRepository } from './auth/auth-repository';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AuthProvider,
  ApplicationShell,
  FullPage,
  WorkspaceProvider,
  websitePreferences,
} from '@filecab/library';
import { QueryClientProvider } from '@tanstack/react-query';
import { API_ORIGIN, queryClient } from './auth/session';
import './styles.scss';
import { OnlineLibrary } from './online-library/components/online-library/online-library';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider repository={authRepository}>
        <ApplicationShell storage={websitePreferences}>
          <WorkspaceProvider origin={API_ORIGIN}>
            <FullPage renderLibrary={(category) => <OnlineLibrary category={category} />} />
          </WorkspaceProvider>
        </ApplicationShell>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
