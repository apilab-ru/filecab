import { useEffect, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, IconName } from '@filecab/ui';
import { useInterfacePreferences } from '../../hooks/use-interface-preferences';
import type { ProgressControlProps } from './model-progress-control';
import './progress-control.scss';

/** Converts a click on the progress bar to the episode at that position. */
function progressAt(event: MouseEvent<HTMLElement>, total: number): number {
  const box = event.currentTarget.getBoundingClientRect();
  const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0;

  return Math.round(Math.min(1, Math.max(0, ratio)) * total);
}

/**
 * Shows episode progress with − and +, a number field, the total and a progress bar. A click on
 * the bar sets the progress to the episode at the click position.
 */
export function ProgressControl({
  value,
  total,
  disabled = false,
  onChange,
  live = false,
  compact = false,
  describedBy,
  className = '',
}: ProgressControlProps) {
  const { t } = useTranslation();
  const { locale } = useInterfacePreferences();
  const [text, setText] = useState(String(value));
  const number = new Intl.NumberFormat(locale);
  const known = total !== null && total > 0;
  const filled = known ? Math.min(100, (value / total) * 100) : 0;

  useEffect(() => setText(String(value)), [value]);

  const report = (next: number) => {
    if (!Number.isSafeInteger(next) || next < 0) {
      setText(String(value));

      return;
    }

    if (next !== value) onChange(next);
  };

  return (
    <div className={`progress-control${compact ? ' progress-control--compact' : ''} ${className}`}>
      <div className="progress-control__row">
        {!compact && (
          <Button
            type="button"
            className="progress-control__step"
            aria-label={t('progressDecrease')}
            disabled={disabled || value <= 0}
            onClick={() => report(value - 1)}
          >
            <Icon name={IconName.Minus} />
          </Button>
        )}
        <input
          className="progress-control__count"
          aria-label={t('Progress')}
          aria-describedby={describedBy}
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '');

            setText(digits);

            if (live && digits !== '') report(Number(digits));
          }}
          onBlur={() => report(text === '' ? NaN : Number(text))}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !live) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <span className="progress-control__total">
          / {total === null ? '?' : number.format(total)}
        </span>
        {!compact && (
          <Button
            type="button"
            className="progress-control__step progress-control__step--add"
            aria-label={t('progressIncrease')}
            disabled={disabled}
            onClick={() => report(value + 1)}
          >
            <Icon name={IconName.Plus} />
          </Button>
        )}
      </div>
      {!compact && (
        // − and + and the number field give the same control to keyboard and screen reader users.
        <div
          className="progress-control__track"
          aria-hidden="true"
          data-clickable={known && !disabled ? '' : undefined}
          onClick={(event) => {
            if (known && !disabled) report(progressAt(event, total));
          }}
        >
          <div className="progress-control__fill" style={{ width: `${filled}%` }} />
        </div>
      )}
    </div>
  );
}
