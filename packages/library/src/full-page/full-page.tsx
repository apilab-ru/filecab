import { useTranslation } from 'react-i18next';
import '../styles/interface-controls.scss';
import './full-page.scss';

import { Navigate, Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { Category } from '@filecab/contracts';
import { Button, Icon, IconName, FILECAB_ICON_URL, Select } from '@filecab/ui';
import { FULL_MODES, MODE_LABELS, NAV_ICONS } from '../application-shell/model-application-shell';
import { useInterfacePreferences } from '../hooks/use-interface-preferences';
import { LibraryMode } from '../models/library-mode';
import { LibraryPage } from '../library-page/library-page';
import { CatalogPage } from '../catalog-page/catalog-page';
import { SettingsPage } from '../settings-page/settings-page';
import type { FullPageProps } from './model-full-page';

/** Renders full-page navigation and routes while retaining the library adapter. */
export function FullPage({ iconUrl = FILECAB_ICON_URL, children, renderLibrary }: FullPageProps) {
  const { t } = useTranslation();
  const { locale, setLocale } = useInterfacePreferences();
  const route = useMatch('/:mode/:category');
  const settings = useMatch('/settings');
  let mode = LibraryMode.Library;

  if (settings) mode = LibraryMode.Settings;

  if (route?.params.mode === LibraryMode.Catalog) mode = LibraryMode.Catalog;

  const category = Object.values(Category).includes(route?.params.category as Category)
    ? (route?.params.category as Category)
    : Category.Anime;
  const routerNavigate = useNavigate();
  const navigate = (nextCategory: Category, nextMode: LibraryMode) => {
    if (nextCategory === category && nextMode === mode) return;

    routerNavigate(
      nextMode === LibraryMode.Settings ? '/settings' : `/${nextMode}/${nextCategory}`,
    );
  };

  return (
    <div className="full-page">
      <aside className="full-page__sidebar">
        <div className="full-page__header">
          <div className="full-page__brand">
            <img className="full-page__mark" src={iconUrl} alt="" width="30" height="34" />
            Filecab
          </div>
        </div>
        <nav className="full-page__navigation" aria-label={t('navigation')}>
          {FULL_MODES.map((nextMode) => (
            <Button
              key={nextMode}
              aria-current={mode === nextMode ? 'page' : undefined}
              onClick={() => navigate(category, nextMode)}
            >
              <Icon name={NAV_ICONS[nextMode]} />
              {t(MODE_LABELS[nextMode])}
            </Button>
          ))}
        </nav>
        <label className="interface-preference full-page__language">
          <span className="full-page__language-label">{t('language')}</span>
          <span className="full-page__language-control">
            <Icon name={IconName.Globe} />
            <Select
              className="interface-select"
              aria-label={t('language')}
              placeholder={t('language')}
              value={locale}
              onValueChange={setLocale}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ru', label: 'Русский' },
              ]}
            />
          </span>
        </label>
      </aside>
      <main className="full-page__main">
        {mode !== LibraryMode.Settings && (
          <nav className="full-page__categories" aria-label={t('categories')}>
            {Object.values(Category).map((nextCategory) => (
              <Button
                key={nextCategory}
                aria-current={category === nextCategory ? 'page' : undefined}
                onClick={() => navigate(nextCategory, mode)}
              >
                {t(nextCategory)}
              </Button>
            ))}
          </nav>
        )}
        <LibraryPage hidden={mode !== LibraryMode.Library}>
          {renderLibrary?.(category)}
          {children}
        </LibraryPage>
        <Routes>
          <Route path="/library/anime" element={null} />
          <Route path="/library/films" element={null} />
          <Route path="/library/tv" element={null} />
          <Route path="/catalog/anime" element={<CatalogPage />} />
          <Route path="/catalog/films" element={<CatalogPage />} />
          <Route path="/catalog/tv" element={<CatalogPage />} />
          <Route path="/settings" element={<SettingsPage popup={false} />} />
          <Route path="*" element={<Navigate replace to="/library/anime" />} />
        </Routes>
      </main>
    </div>
  );
}
