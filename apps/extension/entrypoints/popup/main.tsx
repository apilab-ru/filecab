import { StrictMode } from 'react';
import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { Library } from '@filecab/library';
import { AuthControls } from '../../src/auth/auth-controls';
import '../../styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="popup">
      <a
        className="popup__full-page-link"
        href={browser.runtime.getURL('/full-page.html')}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open full page
      </a>
      <AuthControls />
      <Library name="Filecabz" />
    </main>
  </StrictMode>,
);
