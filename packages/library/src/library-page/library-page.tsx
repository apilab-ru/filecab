import './library-page.scss';

import type { ReactNode } from 'react';

/** Renders the active library browsing page. */
export function LibraryPage({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  return (
    <div className="library-page" hidden={hidden}>
      {children}
    </div>
  );
}
