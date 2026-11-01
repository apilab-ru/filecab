import { Panel } from '@filecab/ui';
import type { ScaffoldInfo } from '@filecab/contracts';

export function Library({ name }: ScaffoldInfo) {
  return (
    <Panel>
      <h1 className="library__title">{name}</h1>
      <p className="library__description">Workspace scaffold.Test</p>
    </Panel>
  );
}
