import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { IMPORT_PREVIEW as PREVIEW } from '../../../.storybook/fixtures';
import { ListSyncPreview } from './list-sync-preview';

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
