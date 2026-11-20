import { useTranslation } from 'react-i18next';
import { Status } from '@filecab/contracts';
import { Select } from '@filecab/ui';
import type { StatusSelectProps } from './model-status-select';
import './status-select.scss';

/**
 * Shows the entry status as a colored dropdown. Its width fits the longest status label, so a
 * status change or an open list does not move the layout.
 */
export function StatusSelect({
  value,
  disabled,
  onChange,
  className = '',
  allowNone = false,
}: StatusSelectProps) {
  const { t } = useTranslation();

  return (
    <Select<Status | null>
      aria-label={t('Status')}
      dropdown
      stableWidth
      className={`status-select status-select--${value ?? 'none'} ${className}`}
      disabled={disabled}
      value={value}
      placeholder={t(allowNone ? 'No status' : 'Status')}
      options={[
        ...(allowNone ? [{ value: null, label: t('No status') }] : []),
        ...Object.values(Status).map((status) => ({ value: status, label: t(status) })),
      ]}
      onValueChange={(status) => {
        if (status !== value) onChange(status);
      }}
    />
  );
}
