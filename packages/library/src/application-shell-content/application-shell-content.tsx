import { useContext } from 'react';
import { Button, ConfirmDialog } from '@filecab/ui';
import { Context } from '../models/interface-context';
import { ApplicationShellContentContext } from '../models/application-shell-content-context';
import { useTranslation } from 'react-i18next';
import { useDraftGuard } from '../hooks/use-draft-guard';
export { useDraftGuard } from '../hooks/use-draft-guard';

export { LibraryMode, Theme, websitePreferences } from '../preferences';
export type { InterfacePreferences, PreferenceStorage } from '../preferences';
export { browserLocale } from '../i18n/browser-locale';

/** Provides translations and draft protection around the entry point's composed layout. */
export function ApplicationShellContent() {
  const children = useContext(ApplicationShellContentContext);
  const { setDirty, confirmation } = useDraftGuard();

  const { t } = useTranslation();

  return (
    <Context.Provider
      value={{
        setDirty,
      }}
    >
      {children}
      <ConfirmDialog
        open={confirmation.open}
        onOpenChange={confirmation.onOpenChange}
        title={t('unsaved')}
        description={t('unsavedDescription')}
      >
        <Button onClick={confirmation.onSave}>{t('save')}</Button>
        <Button onClick={confirmation.onDiscard}>{t('discard')}</Button>
        <Button onClick={confirmation.onContinueEditing}>{t('continueEditing')}</Button>
      </ConfirmDialog>
    </Context.Provider>
  );
}
