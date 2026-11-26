import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { parseLibraryImport, planLibraryImport, type Entry } from '@filecab/contracts';
import { ENTRY } from '../../../.storybook/fixtures';
import { StoryWorkspace } from '../../../.storybook/story-workspace/story-workspace';
import type { LibraryImportRepository } from '../../models/library-import';
import { LibraryImportSettings } from './library-import-settings';

/** Checks files with the real parser and planner against the given library. */
function importer(entries: Entry[]): LibraryImportRepository {
  return {
    previewImport: async (text) => {
      const parsed = parseLibraryImport(text);
      const rows = parsed.issues.length ? [] : planLibraryImport(parsed.rows, entries);

      return {
        issues: parsed.issues,
        rows,
        confirm: fn(async (lines: number[]) => ({
          schemaVersion: 1 as const,
          added: lines.length,
          skipped: rows.length - lines.length,
          entries: [],
        })),
      };
    },
  };
}

const meta = {
  title: 'Library/LibraryImportSettings',
  component: LibraryImportSettings,
  render: (args) => (
    <StoryWorkspace entries={[ENTRY]} importer={importer([ENTRY])}>
      {() => <LibraryImportSettings {...args} />}
    </StoryWorkspace>
  ),
} satisfies Meta<typeof LibraryImportSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Popup: Story = {
  args: { importUrl: 'https://filecab.example/settings' },
};
