import type {} from '../models/i18next';
import { createInstance, type i18n } from 'i18next';
import { Locale } from '@filecab/contracts';
import { EN } from '../locales/en';
import { RU } from '../locales/ru';

const RESOURCES = {
  [Locale.En]: { translation: EN },
  [Locale.Ru]: { translation: RU },
};

/** Creates an independent, synchronously initialized translator with bundled offline resources. */
export function createI18n(locale: Locale): i18n {
  const instance = createInstance();
  void instance.init({
    resources: RESOURCES,
    lng: locale,
    supportedLngs: Object.values(Locale),
    fallbackLng: Locale.En,
    defaultNS: 'translation',
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

  return instance;
}
