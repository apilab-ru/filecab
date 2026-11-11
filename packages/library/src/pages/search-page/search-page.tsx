import { Panel } from '@filecab/ui';

/** Renders the popup search route's current availability message. */
export function SearchPage({ message }: { message: string }) {
  return <Panel>{message}</Panel>;
}
