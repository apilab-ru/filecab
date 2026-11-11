import { IconName } from '@filecab/ui';
import { LibraryMode } from '../../models/library-mode';
import type { MessageKey } from '../../models/message-key';

export const FULL_MODES = [LibraryMode.Library, LibraryMode.Catalog, LibraryMode.Settings];

export const NAV_ICONS = {
  library: IconName.Library,
  catalog: IconName.Search,
  settings: IconName.Settings,
  page: IconName.Library,
  search: IconName.Search,
};

export const MODE_LABELS = {
  library: 'library',
  catalog: 'catalog',
  settings: 'settings',
  page: 'page',
  search: 'search',
} as const satisfies Record<LibraryMode, MessageKey>;
