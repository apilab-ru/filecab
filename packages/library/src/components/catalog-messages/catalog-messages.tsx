import { useTranslation } from 'react-i18next';
import { Button } from '@filecab/ui';
import { useWorkspace } from '../../hooks/use-workspace';
import type { CatalogMessage, CatalogMessagesProps } from './model-catalog-messages';
import './catalog-messages.scss';

/** Shows the catalog matching, connectivity, provider and result status messages. */
export function CatalogMessages({ search, online, onRetry }: CatalogMessagesProps) {
  const { t } = useTranslation();
  const { reconciling, reconcile } = useWorkspace();
  const { result } = search;
  const messages: CatalogMessage[] = [
    {
      key: 'matching',
      visible: Boolean(reconciling),
      text: t('catalogMatching', { title: reconciling?.entry.userTitle ?? '' }),
      action: { label: t('Cancel'), onClick: () => reconcile(null) },
    },
    { key: 'offline', visible: !online, text: t('catalogOffline'), role: 'alert' },
    {
      key: 'error',
      visible: search.failed || search.capabilityError,
      text: t('catalogServiceError'),
      role: 'alert',
      action: { label: t('retry'), onClick: onRetry },
    },
    {
      key: 'unavailable',
      visible: Boolean(search.capabilities && !search.capability),
      text: t('catalogProviderUnavailable'),
      role: 'status',
    },
    {
      key: 'query',
      visible: Boolean(search.capability && !search.canSearch),
      text: t('catalogEnterQuery'),
    },
    {
      key: 'stale',
      visible: Boolean(result?.stale),
      text: t('catalogStale', { date: result?.cachedAt ?? '' }),
    },
    {
      key: 'limited',
      visible: Boolean(result?.limitation && result.limitation !== 'none'),
      text: t('catalogLimited'),
      role: 'status',
    },
    {
      key: 'empty',
      visible: Boolean(result && !result.results.length),
      text: t('catalogEmpty'),
      role: 'status',
    },
  ];

  return messages
    .filter((message) => message.visible)
    .map(({ key, text, role, action }) => (
      <p key={key} className="catalog-message" role={role}>
        {text}
        {action && (
          <>
            {' '}
            <Button onClick={action.onClick}>{action.label}</Button>
          </>
        )}
      </p>
    ));
}
