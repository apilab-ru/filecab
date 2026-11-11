import { Locale } from '@filecab/contracts';

/** Selects the first supported browser language, falling back to English. */
export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0];

    if (base === Locale.En || base === Locale.Ru) return base;
  }

  return Locale.En;
}
