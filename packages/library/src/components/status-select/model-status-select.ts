import type { Status } from '@filecab/contracts';

/** Selects the status of a saved entry. */
export interface StatusSelectProps {
  value: Status | null;
  disabled?: boolean;
  onChange: (status: Status | null) => void;
  className?: string;
  /** Offers No status, which clears the status. */
  allowNone?: boolean;
}
