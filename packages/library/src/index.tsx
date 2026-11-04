import { Panel } from '@filecab/ui';

export function Library({ name }: { name: string }) {
  return (
    <Panel>
      <h1 className="library__title">{name}</h1>
      <p className="library__description">Workspace scaffold.Test</p>
    </Panel>
  );
}
