import '../title-results/title-results.scss';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Status } from '@filecab/contracts';
import { ENTRY, SNAPSHOT } from '../../../.storybook/fixtures';
import { StoryWorkspace } from '../../../.storybook/story-workspace/story-workspace';
import { LibraryCard } from './library-card';

const meta = {
  title: 'Library/LibraryCard',
  component: LibraryCard,
  render: (args) => (
    <StoryWorkspace entries={args.entry ? [args.entry] : []}>
      {(entries) => (
        <ul className="title-results title-results--grid">
          <LibraryCard {...args} entry={entries[0]} />
        </ul>
      )}
    </StoryWorkspace>
  ),
  args: {
    onGenre: fn(),
  },
} satisfies Meta<typeof LibraryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LibraryEntry: Story = {
  args: { entry: ENTRY, edit: fn(), remove: fn() },
};

export const Unrated: Story = {
  args: {
    entry: { ...ENTRY, status: Status.Planned, rating: 0, progress: 0 },
    edit: fn(),
    remove: fn(),
  },
};

export const CatalogResult: Story = {
  args: {
    snapshot: SNAPSHOT,
    showProviderRating: true,
    primaryAction: { label: 'Add', onClick: fn() },
  },
};

export const CatalogResultSaved: Story = {
  args: {
    snapshot: SNAPSHOT,
    showProviderRating: true,
    primaryAction: { label: 'In library', disabled: true, onClick: fn() },
  },
};

export const PublicLibrary: Story = {
  args: { entry: { ...ENTRY, status: Status.Complete, progress: 12 }, readOnly: true },
};

export const NoPoster: Story = {
  args: {
    entry: {
      ...ENTRY,
      userTitle: 'A very long custom title that does not fit on one line of the card',
      snapshot: { ...SNAPSHOT, posterUrl: null, year: null, genres: [] },
    },
    edit: fn(),
  },
};

export const WithAlert: Story = {
  args: {
    snapshot: SNAPSHOT,
    primaryAction: { label: 'Add', onClick: fn() },
    alert: 'The title could not be added. Try again.',
  },
};
