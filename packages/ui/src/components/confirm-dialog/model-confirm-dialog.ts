import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Places caller controls next to the dialog title. */
  headerActions?: ReactNode;
  children?: ReactNode;
  /** Uses a wider dialog for lists and tables. */
  wide?: boolean;
  /** Adds a class to the dialog popup for a caller-specific layout. */
  className?: string;
}
