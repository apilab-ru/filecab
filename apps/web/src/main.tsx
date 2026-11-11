import { authRepository } from './auth/auth-repository';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, ApplicationShell, FullPage, websitePreferences } from '@filecab/library';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './auth/session';
import './styles.scss';
import { OnlineLibrary } from './online-library/online-library';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider repository={authRepository}>
        <ApplicationShell storage={websitePreferences}>
          <FullPage renderLibrary={(category) => <OnlineLibrary category={category} />} />
        </ApplicationShell>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
