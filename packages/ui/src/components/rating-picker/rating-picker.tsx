import { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { IconName } from '../../models/icon-name';
import type { RatingPickerProps } from './model-rating-picker';
import './rating-picker.scss';

const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Selects or clears a personal score and closes only after a successful save. */
export function RatingPicker({
  value,
  anchor,
  label,
  title,
  clearLabel,
  unratedLabel,
  outlined = false,
  disabled,
  busy,
  error,
  onChange,
}: RatingPickerProps) {
  const [open, setOpen] = useState(false);
  const select = async (score: number) => {
    if (busy || disabled) return;

    // Choosing the current score is not a change, so close without another write.
    if (score === value) {
      setOpen(false);

      return;
    }

    if (await onChange(score)) setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={`fc-rating-picker__trigger${outlined ? ' fc-rating-picker__trigger--outlined' : ''}`}
        aria-label={label}
        disabled={disabled || busy}
      >
        <span
          className={`fc-rating-picker__star${value > 0 ? ' fc-rating-picker__star--rated' : ''}`}
        >
          <Icon name={value > 0 ? IconName.Star : IconName.StarOutline} />
        </span>
        {value > 0 ? `${value} / 10` : unratedLabel}
        {outlined && (
          <span className="fc-rating-picker__chevron">
            <Icon name={IconName.Down} />
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="fc-rating-picker__positioner"
          anchor={anchor}
          side="top"
          align="end"
          sideOffset={8}
        >
          <Popover.Popup className="fc-rating-picker__popup" aria-busy={busy}>
            <div className="fc-rating-picker__header">
              <Popover.Title className="fc-rating-picker__title">{title}</Popover.Title>
              <Button
                className="fc-rating-picker__clear"
                disabled={disabled || busy || value === 0}
                onClick={() => {
                  void select(0);
                }}
              >
                {clearLabel}
              </Button>
            </div>
            <div className="fc-rating-picker__scores" role="group" aria-label={title}>
              {SCORES.map((score) => (
                <Button
                  key={score}
                  className="fc-rating-picker__score"
                  aria-pressed={value === score}
                  disabled={disabled || busy}
                  onClick={() => {
                    void select(score);
                  }}
                >
                  {score}
                </Button>
              ))}
            </div>
            {error && (
              <p className="fc-rating-picker__error" role="alert">
                {error}
              </p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
