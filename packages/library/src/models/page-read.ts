import type { PageExtraction } from '@filecab/contracts';

/** Lists the outcomes of reading the active browser tab. */
export enum PageReadStatus {
  Page = 'page',
  /** The tab is not HTTP or HTTPS, is excluded, or the browser does not allow access. */
  Restricted = 'restricted',
  /** The page did not answer or returned unusable data. */
  Failed = 'failed',
}

/** Returns the extraction result, or the reason that the page cannot be read. */
export type PageReadResult =
  | { status: PageReadStatus.Page; page: PageExtraction }
  | { status: PageReadStatus.Restricted | PageReadStatus.Failed };
