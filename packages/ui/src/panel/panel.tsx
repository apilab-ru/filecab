import type { PropsWithChildren } from 'react';

/** Groups related content in a themed surface. */
export function Panel({ children }: PropsWithChildren) {
  return <section className="panel">{children}</section>;
}
