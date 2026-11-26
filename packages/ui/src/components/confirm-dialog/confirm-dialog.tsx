import './confirm-dialog.scss';

import type { ConfirmDialogProps } from './model-confirm-dialog';
import { Dialog } from '@base-ui/react/dialog';

/** Presents a modal decision with focus trapping and restoration. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  headerActions,
  children,
  wide = false,
  className,
}: ConfirmDialogProps) {
  const heading = <Dialog.Title className="fc-dialog__title">{title}</Dialog.Title>;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fc-dialog__backdrop" />
        <Dialog.Popup
          className={['fc-dialog', wide && 'fc-dialog--wide', className].filter(Boolean).join(' ')}
        >
          {headerActions ? (
            <div className="fc-dialog__header">
              {heading}
              {headerActions}
            </div>
          ) : (
            heading
          )}
          {description && (
            <Dialog.Description className="fc-dialog__description">
              {description}
            </Dialog.Description>
          )}
          <div className="fc-dialog__actions">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
