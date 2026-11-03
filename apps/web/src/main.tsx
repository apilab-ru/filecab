import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Library } from '@filecab/library';
import './styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="web">
      <Library name="Filecab" />
    </main>
  </StrictMode>,
);
