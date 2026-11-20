import { PageCapturePage } from '@filecab/library';
import { readActivePage } from '../../../page/page-reader';

/** Renders the popup Page tab with the extension's active-tab reader. */
export function PopupPage() {
  return <PageCapturePage read={readActivePage} />;
}
