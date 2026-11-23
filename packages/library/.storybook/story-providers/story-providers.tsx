import { useEffect, useLayoutEffect, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../src/i18n/create-i18n';
import { InterfacePreferencesContext } from '../../src/models/interface-preferences';
import { StoryWorkspace } from '../story-workspace/story-workspace';
import type { StoryProvidersProps } from './model-story-providers';

/** Supplies the translator, interface preferences and an empty workspace that library components read. */
export function StoryProviders({ locale, theme, children }: StoryProvidersProps) {
  const i18n = useMemo(() => createI18n(locale), [locale]);
  const preferences = useMemo(
    () => ({ locale, theme, setLocale: () => {}, setTheme: () => {} }),
    [locale, theme],
  );

  useLayoutEffect(() => {
    void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  return (
    <I18nextProvider i18n={i18n}>
      <InterfacePreferencesContext.Provider value={preferences}>
        <StoryWorkspace entries={[]}>{() => children}</StoryWorkspace>
      </InterfacePreferencesContext.Provider>
    </I18nextProvider>
  );
}
