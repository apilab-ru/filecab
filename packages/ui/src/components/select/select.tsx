import './select.scss';

import { Select as BaseSelect } from '@base-ui/react/select';
import type { SelectProps } from './model-select';

/** Renders an accessible select control using Base UI. */
export function Select<T extends string | number | null = string>({
  'aria-label': ariaLabel,
  className = '',
  disabled,
  onValueChange,
  options,
  placeholder,
  value,
}: SelectProps<T>) {
  const hasValue = value !== null && value !== '';
  const selectedIndex = hasValue ? options.findIndex((option) => option.value === value) : -1;

  return (
    <BaseSelect.Root
      value={selectedIndex < 0 ? null : String(selectedIndex)}
      disabled={disabled}
      onValueChange={(nextValue) => {
        const index = nextValue === null ? -1 : Number(nextValue);
        onValueChange((index < 0 ? null : (options[index]?.value ?? null)) as T);
      }}
    >
      <BaseSelect.Trigger className={`fc-select ${className}`} aria-label={ariaLabel}>
        <BaseSelect.Value>
          {() =>
            hasValue
              ? options.find((option) => option.value === value)?.label
              : (placeholder ?? ariaLabel)
          }
        </BaseSelect.Value>
        <BaseSelect.Icon className="fc-select__icon" aria-hidden="true" />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="fc-select__positioner" sideOffset={3}>
          <BaseSelect.Popup className="fc-select__popup">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item
                  key={String(option.value)}
                  className="fc-select__item"
                  value={String(options.indexOf(option))}
                >
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="fc-select__indicator" aria-hidden="true">
                    ✓
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
