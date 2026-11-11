import { Panel } from '@filecab/ui';

/** Renders the popup Page route's current availability message. */
export function PopupPage({ message }: { message: string }) {
  return <Panel>{message}</Panel>;
}
