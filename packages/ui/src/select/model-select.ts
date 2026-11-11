/** Describes one selectable value and its visible label. */
export interface SelectOption<T extends string | number | null = string> {
  value: T;
  label: string;
}

/** Defines the value, options and accessible name for a shared select. */
export interface SelectProps<T extends string | number | null = string> {
  'aria-label': string;
  className?: string;
  disabled?: boolean;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  value: T | null;
}
