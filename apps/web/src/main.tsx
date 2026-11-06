import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Library } from '@filecab/library';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthControls } from './auth/auth-controls';
import { queryClient } from './auth/session';
import './styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <main className="web">
        <AuthControls />
        <Library name="Filecab" />
      </main>
    </QueryClientProvider>
  </StrictMode>,
);
