import type { useCatalogSearch } from '../../hooks/use-catalog-search';

/** Supplies the catalog search state that selects the visible messages. */
export interface CatalogMessagesProps {
  search: ReturnType<typeof useCatalogSearch>;
  online: boolean;
  onRetry: () => void;
}

/** Describes one catalog status message and its optional action. */
export interface CatalogMessage {
  key: string;
  visible: boolean;
  text: string;
  role?: 'alert' | 'status';
  action?: { label: string; onClick: () => void };
}
