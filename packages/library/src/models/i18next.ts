import 'i18next';
import type { EN } from '../i18n/locales/en';

declare module 'i18next' {
  /** Types the bundled translation catalog and its literal, flat message keys. */
  interface CustomTypeOptions {
    defaultNS: 'translation';
    keySeparator: false;
    nsSeparator: false;
    returnNull: false;
    resources: { translation: typeof EN };
  }
}
