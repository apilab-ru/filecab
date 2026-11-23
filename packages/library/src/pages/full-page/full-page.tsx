import { useTranslation } from 'react-i18next';
import '../../styles/interface-controls.scss';
import './full-page.scss';

import { Navigate, Route, Routes, useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { Category } from '@filecab/contracts';
import { Button, Icon, IconName, FILECAB_ICON_URL, Select } from '@filecab/ui';
import {
  FULL_MODES,
  MODE_LABELS,
  NAV_ICONS,
} from '../../components/application-shell/model-application-shell';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { LibraryMode } from '../../models/library-mode';
import { LibraryPage } from '../library-page/library-page';
import { CatalogPage } from '../catalog-page/catalog-page';
import { SettingsPage } from '../settings-page/settings-page';
import type { FullPageProps } from './model-full-page';

/** Renders full-page navigation and routes while retaining the library adapter. */
export function FullPage({
  iconUrl = FILECAB_ICON_URL,
  children,
  renderLibrary,
  renderPublicLibrary,
}: FullPageProps) {
  const { t } = useTranslation();
  const [parameters, setParameters] = useSearchParams();
  const view = parameters.get('view') === 'list' ? 'list' : 'grid';
  const setView = (value: string) => {
    const next = new URLSearchParams(parameters);
    next.set('view', value);
    setParameters(next, { replace: true });
  };
  const { locale, setLocale } = useInterfacePreferences();
  const route = useMatch('/:mode/:category');
  const settings = useMatch('/settings');
  const publicCategoryRoute = useMatch('/u/:username/:category');
  const publicRoute = useMatch('/u/:username');
  const username = renderPublicLibrary
    ? (publicCategoryRoute ?? publicRoute)?.params.username
    : undefined;
  const publicMode = username !== undefined;
  let mode = LibraryMode.Library;

  if (settings) mode = LibraryMode.Settings;

  if (route?.params.mode === LibraryMode.Catalog) mode = LibraryMode.Catalog;

  const routeCategory = publicMode ? publicCategoryRoute?.params.category : route?.params.category;
  const category = Object.values(Category).includes(routeCategory as Category)
    ? (routeCategory as Category)
    : Category.Anime;
  const modes = publicMode
    ? FULL_MODES.filter((nextMode) => nextMode !== LibraryMode.Catalog)
    : FULL_MODES;
  const routerNavigate = useNavigate();
  const navigate = (nextCategory: Category, nextMode: LibraryMode) => {
    if (nextCategory === category && nextMode === mode) return;

    if (nextMode === LibraryMode.Settings) {
      routerNavigate('/settings');

      return;
    }

    // Keep the chosen layout; other query parameters belong to the previous screen.
    const layout = view === 'list' ? '?view=list' : '';

    if (publicMode && nextMode === LibraryMode.Library) {
      routerNavigate(`/u/${encodeURIComponent(username)}/${nextCategory}${layout}`);

      return;
    }

    routerNavigate(`/${nextMode}/${nextCategory}${layout}`);
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
          {modes.map((nextMode) => (
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
            {publicMode && (
              <h1 className="full-page__public-title" id="public-library-heading">
                {t('publicLibraryHeading', { username: username.toLowerCase() })}
              </h1>
            )}
            {Object.values(Category).map((nextCategory) => (
              <Button
                key={nextCategory}
                aria-current={category === nextCategory ? 'page' : undefined}
                onClick={() => navigate(nextCategory, mode)}
              >
                {t(nextCategory)}
              </Button>
            ))}
            <div className="full-page__views">
              <Button
                aria-label={t('listView')}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                <Icon name={IconName.List} />
              </Button>
              <Button
                aria-label={t('gridView')}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
              >
                <Icon name={IconName.Grid} />
              </Button>
            </div>
          </nav>
        )}
        {publicMode && renderPublicLibrary?.(username, category)}
        <LibraryPage hidden={mode !== LibraryMode.Library || publicMode}>
          {renderLibrary?.(category)}
          {children}
        </LibraryPage>
        <Routes>
          <Route path="/library/anime" element={null} />
          <Route path="/library/films" element={null} />
          <Route path="/library/tv" element={null} />
          <Route path="/catalog/anime" element={<CatalogPage category={category} />} />
          <Route path="/catalog/films" element={<CatalogPage category={category} />} />
          <Route path="/catalog/tv" element={<CatalogPage category={category} />} />
          <Route path="/settings" element={<SettingsPage popup={false} />} />
          {renderPublicLibrary && <Route path="/u/:username" element={null} />}
          {renderPublicLibrary && <Route path="/u/:username/:category" element={null} />}
          <Route path="*" element={<Navigate replace to="/library/anime" />} />
        </Routes>
      </main>
    </div>
  );
}
