import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthControls } from '../../components/auth-controls/auth-controls';
import { BackupSettings } from '../../components/backup-settings/backup-settings';
import { LibraryImportSettings } from '../../components/library-import-settings/library-import-settings';
import { CatalogMatchSettings } from '../../components/catalog-match-settings/catalog-match-settings';
import { PublicLibrarySettings } from '../../components/public-library-settings/public-library-settings';
import { ListSyncSettings } from '../../components/list-sync-settings/list-sync-settings';
import '../../styles/interface-controls.scss';
import './settings-page.scss';

import { Button, Icon, IconName, Select } from '@filecab/ui';
import type { CatalogMatchTarget } from '@filecab/contracts';
import { useAuth } from '../../hooks/use-auth';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import { useSyncSettings } from '../../hooks/use-sync-settings';
import { Theme } from '../../models/theme';
import type { SettingsPageProps } from './model-settings-page';

/** Renders account, synchronization, appearance, and popup language settings. */
export function SettingsPage({ popup, restoreUrl }: SettingsPageProps) {
  const { t } = useTranslation();
  const { locale, theme, setLocale, setTheme } = useInterfacePreferences();
  const { syncSettings, setSyncPanel } = useSyncSettings();
  const { account, publicLibrary, listSync, catalogMatch } = useAuth();
  // Entries of the latest import. The catalog data job starts for them.
  const [imported, setImported] = useState<CatalogMatchTarget[] | null>(null);

  return (
    <div className="settings-content">
      <section className="settings-card">
        <h2 className="settings-card__title">{t('account')}</h2>
        <AuthControls />
      </section>
      <section className="settings-card">
        <h2 className="settings-card__title">{t('sync')}</h2>
        <div className="settings-sync">
          <Button
            className="fc-button--primary settings-sync__button"
            disabled={!syncSettings?.enabled}
            onClick={() => syncSettings?.refresh()}
          >
            <Icon name={IconName.Refresh} />
            {t('syncNow')}
          </Button>
          {syncSettings?.lastSuccess && (
            <p className="settings-sync__success">
              <Icon name={IconName.Check} />
              <span>
                {t(syncSettings.online ? 'lastRefresh' : 'lastSuccessfulSync')}:{' '}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(syncSettings.lastSuccess)}
              </span>
            </p>
          )}
          <p className="settings-sync__message" role="status">
            {syncSettings?.message ?? t('syncSignIn')}
          </p>
          <div className="settings-sync__panel" ref={setSyncPanel} />
        </div>
      </section>
      {account && (
        <section className="settings-card">
          <h2 className="settings-card__title">{t('publicLibrary')}</h2>
          <PublicLibrarySettings
            key={account.ownerId}
            ownerId={account.ownerId}
            repository={publicLibrary}
          />
        </section>
      )}
      {account && (
        <ListSyncSettings key={account.ownerId} ownerId={account.ownerId} repository={listSync} />
      )}
      <section className="settings-card">
        <h2 className="settings-card__title">{t('backup')}</h2>
        <BackupSettings restoreUrl={restoreUrl} />
      </section>
      <section className="settings-card">
        <h2 className="settings-card__title">{t('libraryImport')}</h2>
        <LibraryImportSettings importUrl={restoreUrl} onImported={setImported} />
      </section>
      {account && (
        <section className="settings-card">
          <h2 className="settings-card__title">{t('catalogMatch')}</h2>
          <CatalogMatchSettings
            key={account.ownerId}
            ownerId={account.ownerId}
            repository={catalogMatch}
            imported={imported}
          />
        </section>
      )}
      <section className="settings-card">
        <h2 className="settings-card__title">{t('theme')}</h2>
        <div className="settings-appearance" role="group" aria-label={t('theme')}>
          <Button aria-pressed={theme === Theme.Light} onClick={() => setTheme(Theme.Light)}>
            <Icon name={IconName.Sun} />
            {t('light')}
          </Button>
          <Button aria-pressed={theme === Theme.Dark} onClick={() => setTheme(Theme.Dark)}>
            <Icon name={IconName.Moon} />
            {t('dark')}
          </Button>
        </div>
      </section>
      {popup && (
        <section className="settings-card settings-card--language">
          <label className="interface-preference">
            {t('language')}
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
          </label>
        </section>
      )}
    </div>
  );
}
