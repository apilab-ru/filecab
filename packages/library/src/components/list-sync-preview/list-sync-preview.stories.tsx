import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Category, ListSyncField, Status, type ListSyncImportPreview } from '@filecab/contracts';
import { ListSyncPreview } from './list-sync-preview';

const PREVIEW: ListSyncImportPreview = {
  schemaVersion: 1,
  jobId: 'job-1',
  additions: [
    {
      key: 'remote-1',
      title: 'Wind of the Stars',
      category: Category.Anime,
      values: { status: Status.Process, rating: 8, progress: 5 },
    },
    {
      key: 'remote-2',
      title: 'Harbor Lights',
      category: Category.Anime,
      values: { status: Status.Planned, rating: 0, progress: 0 },
    },
  ],
  changes: [
    {
      key: 'remote-3',
      entryId: 'entry-3',
      title: 'Silent Orchard',
      fields: [
        { field: ListSyncField.Status, current: Status.Process, incoming: Status.Complete },
        { field: ListSyncField.Progress, current: 10, incoming: 24 },
      ],
    },
    {
      key: 'remote-4',
      entryId: 'entry-4',
      title: 'Paper Moon Station',
      fields: [{ field: ListSyncField.Rating, current: 0, incoming: 9 }],
    },
  ],
  unchanged: 37,
};

const meta = {
  title: 'Library/ListSyncPreview',
  component: ListSyncPreview,
  args: {
    preview: PREVIEW,
    busy: false,
    onApply: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ListSyncPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AdditionsAndChanges: Story = {};

export const OnlyAdditions: Story = {
  args: { preview: { ...PREVIEW, changes: [] } },
};

export const OnlyChanges: Story = {
  args: { preview: { ...PREVIEW, additions: [] } },
};

export const NothingToImport: Story = {
  args: { preview: { ...PREVIEW, additions: [], changes: [], unchanged: 42 } },
};

export const Busy: Story = {
  args: { busy: true },
};
