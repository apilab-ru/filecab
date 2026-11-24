import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  Category,
  ListSyncErrorCode,
  ListSyncField,
  ListSyncIssue,
  ListSyncJobKind,
  ListSyncJobState,
  ListSyncOutcome,
  ListSyncState,
  type ListSyncConnection,
  type ListSyncJob,
  type ListSyncOverview,
} from '@filecab/contracts';
import { IMPORT_PREVIEW } from '../../../.storybook/fixtures';
import type { ListSyncRepository } from '../../models/list-sync';
import { ListSyncSettings } from './list-sync-settings';

const CONNECTION: ListSyncConnection = {
  accountId: '7',
  accountName: 'hoshi_fan',
  state: ListSyncState.Active,
  fields: [ListSyncField.Status, ListSyncField.Rating, ListSyncField.Progress],
  lastExportAt: '2026-11-20T18:30:00.000Z',
  lastImportAt: '2026-11-18T09:10:00.000Z',
  job: null,
  previewReady: false,
  mappings: 214,
};

const FINISHED_EXPORT: ListSyncJob = {
  jobId: 'job-export',
  kind: ListSyncJobKind.Export,
  state: ListSyncJobState.Succeeded,
  progress: { done: 230, total: 230 },
  result: {
    counts: {
      [ListSyncOutcome.Created]: 4,
      [ListSyncOutcome.Updated]: 11,
      [ListSyncOutcome.Unchanged]: 199,
      [ListSyncOutcome.Skipped]: 16,
    },
    items: [
      {
        title: 'Wind of the Stars',
        entryId: 'e1',
        outcome: ListSyncOutcome.Skipped,
        issue: ListSyncIssue.Unidentified,
      },
      {
        title: 'Harbor Lights',
        entryId: 'e2',
        outcome: ListSyncOutcome.Skipped,
        issue: ListSyncIssue.UnsupportedStatus,
      },
    ],
  },
  error: null,
  createdAt: '2026-11-20T18:29:00.000Z',
  finishedAt: '2026-11-20T18:30:00.000Z',
};

/** Builds an overview with one Shikimori provider. */
function overview(connection: ListSyncConnection | null): ListSyncOverview {
  return {
    schemaVersion: 1,
    providers: [
      { provider: 'shikimori', name: 'Shikimori', categories: [Category.Anime], connection },
    ],
  };
}

/** Builds a repository that always returns the same overview. */
function repository(value: ListSyncOverview): ListSyncRepository {
  const job = value.providers[0]?.connection?.job ?? FINISHED_EXPORT;

  return {
    overview: fn(async () => value),
    connect: fn(async () => {}),
    pause: fn(async () => value),
    resume: fn(async () => value),
    disconnect: fn(async () => value),
    exportList: fn(async () => job),
    importList: fn(async () => job),
    preview: fn(async () => IMPORT_PREVIEW),
    apply: fn(async () => job),
    cancelPreview: fn(async () => value),
  };
}

const meta = {
  title: 'Library/ListSyncSettings',
  component: ListSyncSettings,
  args: { ownerId: 'owner-1', repository: repository(overview(null)) },
} satisfies Meta<typeof ListSyncSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotConnected: Story = {};

export const ExportFinished: Story = {
  args: { repository: repository(overview({ ...CONNECTION, job: FINISHED_EXPORT })) },
};

export const ImportRunning: Story = {
  args: {
    repository: repository(
      overview({
        ...CONNECTION,
        job: {
          ...FINISHED_EXPORT,
          kind: ListSyncJobKind.ImportApply,
          state: ListSyncJobState.Running,
          progress: { done: 40, total: 120 },
          result: null,
          finishedAt: null,
        },
      }),
    ),
  },
};

export const ImportPreview: Story = {
  args: {
    repository: repository(
      overview({
        ...CONNECTION,
        previewReady: true,
        job: {
          ...FINISHED_EXPORT,
          kind: ListSyncJobKind.ImportPreview,
          result: null,
        },
      }),
    ),
  },
};

export const AuthorizationRequired: Story = {
  args: {
    repository: repository(
      overview({
        ...CONNECTION,
        state: ListSyncState.AuthorizationRequired,
        job: {
          ...FINISHED_EXPORT,
          state: ListSyncJobState.Failed,
          result: null,
          error: ListSyncErrorCode.AuthorizationRequired,
        },
      }),
    ),
  },
};

export const Paused: Story = {
  args: { repository: repository(overview({ ...CONNECTION, state: ListSyncState.Paused })) },
};

export const RequestFailed: Story = {
  args: {
    repository: {
      ...repository(overview(CONNECTION)),
      importList: fn(async () => {
        throw new Error('fixture');
      }),
    },
  },
};

export const PreviewScanning: Story = {
  args: {
    repository: repository(
      overview({
        ...CONNECTION,
        job: {
          ...FINISHED_EXPORT,
          kind: ListSyncJobKind.ImportPreview,
          state: ListSyncJobState.Running,
          progress: { done: 0, total: 0 },
          result: null,
          finishedAt: null,
        },
      }),
    ),
  },
};
