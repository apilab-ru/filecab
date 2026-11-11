import { useTranslation } from 'react-i18next';
import { Panel } from '@filecab/ui';

/** Renders the localized catalog route's current availability message. */
export function CatalogPage() {
  const { t } = useTranslation();

  return <Panel>{t('unavailableCatalog')}</Panel>;
}
