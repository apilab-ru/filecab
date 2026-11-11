import { useTranslation } from '@filecab/library';
import { PopupPage } from '../popup-page/popup-page';
import './popup.scss';

import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { Button, Icon, IconName, FILECAB_ICON_URL } from '@filecab/ui';
import { LibraryMode, LibraryPage, SearchPage, SettingsPage } from '@filecab/library';
import type { PopupProps } from './model-popup';

const MODES = [LibraryMode.Page, LibraryMode.Search];

/** Renders popup navigation and routes while retaining the background data adapter. */
export function Popup({ fullPageUrl, iconUrl = FILECAB_ICON_URL, children }: PopupProps) {
  const routerNavigate = useNavigate();
  const { t } = useTranslation();

  const mode = (useMatch('/:mode/*')?.params.mode as LibraryMode | undefined) ?? LibraryMode.Page;

  const settings = mode === LibraryMode.Settings;

  return (
    <div className="popup">
      <aside className="popup__sidebar">
        <div className="popup__header">
          {settings && (
            <>
              <Button
                className="popup__back"
                aria-label={t('back')}
                onClick={() => routerNavigate('/page/anime')}
              >
                <Icon name={IconName.Back} />
              </Button>
              <h1 className="popup__title">{t('settings')}</h1>
            </>
          )}
          <div className="popup__brand">
            <img className="popup__mark" src={iconUrl} alt="" width="30" height="34" />
            Filecab
          </div>
          {!settings && (
            <div className="popup__header-actions">
              {fullPageUrl && (
                <a
                  className="popup__external"
                  aria-label={t('fullPage')}
                  title={t('fullPage')}
                  href={fullPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name={IconName.External} />
                </a>
              )}
              <Button
                className="popup__icon-button"
                aria-label={t('settings')}
                onClick={() => routerNavigate('/settings')}
              >
                <Icon name={IconName.Settings} />
              </Button>
            </div>
          )}
        </div>
        {!settings && (
          <nav className="popup__navigation" aria-label={t('navigation')}>
            {MODES.map((route) => (
              <Button
                key={route}
                aria-current={mode === route ? 'page' : undefined}
                onClick={() => routerNavigate(`/${route}/anime`)}
              >
                {t(route)}
              </Button>
            ))}
          </nav>
        )}
      </aside>
      <main className="popup__main">
        <LibraryPage hidden>{children}</LibraryPage>
        <Routes>
          <Route path="/page/:category" element={<PopupPage message={t('unavailablePage')} />} />
          <Route path="/search/:category" element={<SearchPage message={t('unavailablePage')} />} />
          <Route path="/settings" element={<SettingsPage popup />} />
          <Route path="*" element={<Navigate replace to="/page/anime" />} />
        </Routes>
      </main>
    </div>
  );
}
