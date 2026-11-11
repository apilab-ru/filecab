import { I18nextProvider } from 'react-i18next';
import { createI18n } from '../../i18n/create-i18n';
import { useCallback, useEffect, useLayoutEffect } from 'react';
import { Locale } from '@filecab/contracts';
import { InterfacePreferencesContext } from '../../models/interface-preferences';
import { useLocalStore } from '../../hooks/use-local-store';
import type { InterfacePreferencesProviderProps } from './model-interface-preferences-provider';
import type { InterfacePreferences } from '../../models/interface-preferences';
import { browserLocale } from '../../i18n/browser-locale';
import { Theme } from '../../models/preferences';

/** Chooses a supported browser locale when no preference has been saved. */
function defaultLocale(): Locale {
  try {
    return browserLocale(navigator.languages) ?? Locale.Ru;
  } catch {
    return Locale.Ru;
  }
}

/** Uses the system color scheme when no theme has been saved. */
function defaultTheme(): Theme {
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? Theme.Dark : Theme.Light;
  } catch {
    return Theme.Light;
  }
}

/** Shares live preferences, persistence and document updates across a shell's consumers. */
export function InterfacePreferencesProvider({
  storage: preferenceStorage,
  children,
}: InterfacePreferencesProviderProps) {
  const [{ preferences, i18n }, { preferences: setPreferences }] = useLocalStore(() => ({
    preferences: {} as InterfacePreferences,
    i18n: createI18n(defaultLocale()),
  }));

  useEffect(() => {
    let active = true;
    let updated = false;

    const unsubscribe = preferenceStorage.subscribe((patch) => {
      if (!active) return;

      updated = true;
      setPreferences((current) => ({ ...current, ...patch }));
    });

    void preferenceStorage
      .read()
      .then((value) => {
        if (!active) return;

        if (!updated) setPreferences(value);
      })
      .catch(() => {});

    return () => {
      active = false;
      unsubscribe();
    };
  }, [preferenceStorage]);

  const locale = preferences.locale ?? defaultLocale();
  const theme = preferences.theme ?? defaultTheme();

  useLayoutEffect(() => {
    void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);

  const persist = useCallback(
    (patch: InterfacePreferences) => {
      setPreferences((current) => ({ ...current, ...patch }));
      void preferenceStorage.write(patch).catch(() => {});
    },
    [preferenceStorage],
  );

  return (
    <I18nextProvider i18n={i18n}>
      <InterfacePreferencesContext.Provider
        value={{
          locale,
          theme,
          setLocale: (locale: Locale | string) => persist({ locale: locale as Locale }),
          setTheme: (theme: Theme | string) => persist({ theme: theme as Theme }),
        }}
      >
        {children}
      </InterfacePreferencesContext.Provider>
    </I18nextProvider>
  );
}
