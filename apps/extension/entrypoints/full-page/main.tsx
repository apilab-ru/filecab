import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LocalLibrary } from '../../src/library/local-library';
import { AuthControls } from '../../src/auth/auth-controls';
import '../../styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="full-page">
      <AuthControls />
      <LocalLibrary name="Filecab" />
    </main>
  </StrictMode>,
);
