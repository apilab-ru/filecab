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
  /**
   * Opens the list below or above the trigger, keeps it inside the window and does not lock the
   * page scroll. By default the selected item covers the trigger, which can push other items out
   * of a small window.
   */
  dropdown?: boolean;
  /** Reserves the width of the longest option label, so a value change never resizes the trigger. */
  stableWidth?: boolean;
}
