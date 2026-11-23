import type { PropsWithChildren } from 'react';
import type { Locale } from '@filecab/contracts';
import type { Theme } from '../../src/models/theme';

/** Selects the interface language and color theme of one story. */
export type StoryProvidersProps = PropsWithChildren<{
  locale: Locale;
  theme: Theme;
}>;
