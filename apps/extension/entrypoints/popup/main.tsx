import { Popup } from '../../src/popup/components/popup/popup';
import { authRepository } from '../../src/auth/auth-repository';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { AuthProvider, ApplicationShell } from '@filecab/library';
import { extensionPreferences } from '../../src/models/interface-preferences';
import { DeviceSync } from '../../src/library/components/device-sync/device-sync';
import '../../styles.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider repository={authRepository}>
      <ApplicationShell
        storage={extensionPreferences}
        iconsBaseUrl={new URL('.', browser.runtime.getURL('/icons/library.svg')).href}
      >
        <Popup
          iconUrl={browser.runtime.getURL('/wish-list-icon.png')}
          fullPageUrl={browser.runtime.getURL('/full-page.html')}
        >
          <DeviceSync />
        </Popup>
      </ApplicationShell>
    </AuthProvider>
  </StrictMode>,
);
