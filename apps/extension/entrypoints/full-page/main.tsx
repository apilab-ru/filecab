import { authRepository } from '../../src/auth/auth-repository';
import { browser } from 'wxt/browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, ApplicationShell, FullPage } from '@filecab/library';
import { extensionPreferences } from '../../src/models/interface-preferences';
import { LocalLibrary } from '../../src/library/components/local-library/local-library';
import '../../styles.scss';

const ICON_BASE_URL = new URL('.', browser.runtime.getURL('/icons/library.svg')).href;
const LOGO_URL = browser.runtime.getURL('/wish-list-icon.png');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider repository={authRepository}>
      <ApplicationShell storage={extensionPreferences} iconsBaseUrl={ICON_BASE_URL}>
        <FullPage
          iconUrl={LOGO_URL}
          renderLibrary={(category) => <LocalLibrary category={category} />}
        />
      </ApplicationShell>
    </AuthProvider>
  </StrictMode>,
);
