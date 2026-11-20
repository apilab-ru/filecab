/** Edits episode progress with steps, a number field and a clickable progress bar. */
export interface ProgressControlProps {
  value: number;
  /** The episode total. Without it, the bar is empty and cannot set a value. */
  total: number | null;
  disabled?: boolean;
  /**
   * Receives each accepted value. A live control reports every typed value, for a form. Otherwise
   * a typed value is reported on Enter or when the field loses focus.
   */
  onChange: (value: number) => void;
  live?: boolean;
  /** Keeps only the number field and the total, for a narrow table cell. */
  compact?: boolean;
  /** The ID of an element that describes the number field. */
  describedBy?: string;
  className?: string;
}
