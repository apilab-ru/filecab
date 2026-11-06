import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Library } from '@filecab/library';
import { AuthControls } from '../../src/auth/auth-controls';
import '../../styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="full-page">
      <AuthControls />
      <Library name="Filecab" />
    </main>
  </StrictMode>,
);
