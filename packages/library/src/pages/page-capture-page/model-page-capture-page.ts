import type { PageReadResult } from '../../models/page-read';

/** Supplies the platform adapter that reads the active browser tab after a user action. */
export interface PageCapturePageProps {
  read: () => Promise<PageReadResult>;
}

export const PAGE_RESULTS_SIZE = 5;
