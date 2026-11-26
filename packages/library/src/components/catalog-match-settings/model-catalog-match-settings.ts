import { CatalogMatchOutcome, type CatalogMatchTarget } from '@filecab/contracts';
import type { CatalogMatchRepository } from '../../models/catalog-match';
import type { MessageKey } from '../../models/message-key';

/** Supplies the account, its repository and the entries of a finished import. */
export interface CatalogMatchSettingsProps {
  ownerId: string;
  repository: CatalogMatchRepository;
  /** New entries of an import. A change starts the provider jobs for them. */
  imported: CatalogMatchTarget[] | null;
}

/** Polls the job every 3 seconds while it waits or runs. */
export const CATALOG_MATCH_POLL_MS = 3000;

/** Names the job of each known provider. Another provider shows its ID. */
export const PROVIDER_LABELS = {
  kinopoisk: 'catalogMatchProviderKinopoisk',
  smotret: 'catalogMatchProviderSmotret',
} as const satisfies Record<string, MessageKey>;

/** Outcomes that the owner can resolve by choosing the catalog title in a dialog. */
export const RESOLVABLE: ReadonlySet<CatalogMatchOutcome> = new Set([
  CatalogMatchOutcome.Ambiguous,
  CatalogMatchOutcome.NotFound,
]);

/** Shows at most this many unlinked entries of each job. */
export const MAX_SHOWN_ITEMS = 20;

/** Labels the outcome counts. */
export const COUNT_LABELS = {
  [CatalogMatchOutcome.Linked]: 'catalogMatchCountLinked',
  [CatalogMatchOutcome.NotFound]: 'catalogMatchCountNotFound',
  [CatalogMatchOutcome.Ambiguous]: 'catalogMatchCountAmbiguous',
  [CatalogMatchOutcome.Duplicate]: 'catalogMatchCountDuplicate',
  [CatalogMatchOutcome.Skipped]: 'catalogMatchCountSkipped',
  [CatalogMatchOutcome.Failed]: 'catalogMatchCountFailed',
} as const satisfies Record<CatalogMatchOutcome, MessageKey>;

/** Explains why an entry was not linked. */
export const ITEM_LABELS = {
  [CatalogMatchOutcome.NotFound]: 'catalogMatchItemNotFound',
  [CatalogMatchOutcome.Ambiguous]: 'catalogMatchItemAmbiguous',
  [CatalogMatchOutcome.Duplicate]: 'catalogMatchItemDuplicate',
  [CatalogMatchOutcome.Skipped]: 'catalogMatchItemSkipped',
  [CatalogMatchOutcome.Failed]: 'catalogMatchItemFailed',
} as const satisfies Record<Exclude<CatalogMatchOutcome, CatalogMatchOutcome.Linked>, MessageKey>;

/** Orders the counts in the summary. */
export const COUNT_ORDER = Object.keys(COUNT_LABELS) as CatalogMatchOutcome[];
