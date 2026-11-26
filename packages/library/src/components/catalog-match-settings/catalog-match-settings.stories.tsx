import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import {
  CatalogMatchJobState,
  CatalogMatchOutcome,
  CatalogMatchPause,
  type CatalogMatchJob,
} from '@filecab/contracts';
import type { CatalogMatchRepository } from '../../models/catalog-match';
import { CatalogMatchSettings } from './catalog-match-settings';

const DONE: CatalogMatchJob = {
  jobId: 'job-1',
  provider: 'kinopoisk',
  state: CatalogMatchJobState.Succeeded,
  progress: { done: 352, total: 352 },
  counts: {
    [CatalogMatchOutcome.Linked]: 301,
    [CatalogMatchOutcome.NotFound]: 29,
    [CatalogMatchOutcome.Ambiguous]: 15,
    [CatalogMatchOutcome.Duplicate]: 7,
  },
  items: [
    { entryId: 'e1', title: 'Опус', outcome: CatalogMatchOutcome.Ambiguous },
    { entryId: 'e2', title: 'Скрытое убийство', outcome: CatalogMatchOutcome.NotFound },
    { entryId: 'e3', title: 'Курск', outcome: CatalogMatchOutcome.Duplicate },
  ],
  pause: null,
  resumeAt: null,
  createdAt: '2026-11-24T10:00:00.000Z',
  finishedAt: '2026-11-24T10:20:00.000Z',
};

/** The anime job of the same account. */
const ANIME: CatalogMatchJob = {
  ...DONE,
  jobId: 'job-2',
  provider: 'smotret',
  progress: { done: 40, total: 40 },
  counts: { [CatalogMatchOutcome.Linked]: 38, [CatalogMatchOutcome.NotFound]: 2 },
  items: [
    { entryId: 'e4', title: 'Эльф не может похудеть', outcome: CatalogMatchOutcome.NotFound },
  ],
};

/** Builds a repository that always returns the given jobs. */
function repository(jobs: CatalogMatchJob[]): CatalogMatchRepository {
  const status = async () => ({ schemaVersion: 1 as const, jobs });

  return { status: fn(status), start: fn(status), stop: fn(status) };
}

const meta = {
  title: 'Library/CatalogMatchSettings',
  component: CatalogMatchSettings,
  args: { ownerId: 'owner-1', imported: null, repository: repository([]) },
} satisfies Meta<typeof CatalogMatchSettings>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NoJob: Story = {};

export const Running: Story = {
  args: {
    repository: repository([
      {
        ...DONE,
        state: CatalogMatchJobState.Running,
        progress: { done: 120, total: 352 },
        counts: { [CatalogMatchOutcome.Linked]: 110, [CatalogMatchOutcome.NotFound]: 10 },
        items: [],
        finishedAt: null,
      },
    ]),
  },
};

/** Kinopoisk waits for its quota while the anime job continues. */
export const ProviderLimit: Story = {
  args: {
    repository: repository([
      {
        ...DONE,
        state: CatalogMatchJobState.Queued,
        progress: { done: 190, total: 352 },
        pause: CatalogMatchPause.ProviderLimit,
        resumeAt: '2026-11-24T16:20:00.000Z',
        finishedAt: null,
      },
      {
        ...ANIME,
        state: CatalogMatchJobState.Running,
        progress: { done: 12, total: 40 },
        counts: { [CatalogMatchOutcome.Linked]: 12 },
        items: [],
        finishedAt: null,
      },
    ]),
  },
};

export const Done: Story = { args: { repository: repository([DONE, ANIME]) } };
