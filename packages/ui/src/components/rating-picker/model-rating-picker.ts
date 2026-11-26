/** Configures the accessible personal rating popup and persistence feedback. */
export interface RatingPickerProps {
  value: number;
  anchor?: () => HTMLElement | null;
  label: string;
  title: string;
  clearLabel: string;
  unratedLabel: string;
  outlined?: boolean;
  disabled?: boolean;
  busy?: boolean;
  error?: string;
  onChange: (value: number) => Promise<boolean>;
}
