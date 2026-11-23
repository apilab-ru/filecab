import './preview.scss';

import type { Preview } from '@storybook/react-vite';
import { Locale } from '@filecab/contracts';
import { Theme } from '../src/models/theme';
import { StoryProviders } from './story-providers/story-providers';

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: Locale.En, title: 'English' },
          { value: Locale.Ru, title: 'Русский' },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: Theme.Light, title: 'Light', icon: 'sun' },
          { value: Theme.Dark, title: 'Dark', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: Locale.En, theme: Theme.Light },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
  },
  decorators: [
    (Story, { globals }) => (
      <StoryProviders locale={globals.locale as Locale} theme={globals.theme as Theme}>
        <Story />
      </StoryProviders>
    ),
  ],
};

export default preview;
