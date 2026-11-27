import { useEffect, useState } from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import type { ImagePreviewProps } from './model-image-preview';
import './image-preview.scss';

/** Shows the full image in a floating frame when the pointer rests on the thumbnail. */
export function ImagePreview({ src, className, onError }: ImagePreviewProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    // The pointer can open the preview while focus stays in the parent dialog.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;

      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', dismiss, true);

    return () => window.removeEventListener('keydown', dismiss, true);
  }, [open]);

  return (
    <PreviewCard.Root open={open} onOpenChange={setOpen}>
      <PreviewCard.Trigger
        delay={220}
        closeDelay={0}
        onClick={() => setOpen(false)}
        render={
          <img
            className={className}
            src={src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={onError}
          />
        }
      />
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          className="fc-image-preview__positioner"
          positionMethod="fixed"
          side="right"
          sideOffset={4}
          collisionPadding={8}
        >
          <PreviewCard.Popup className="fc-image-preview__frame" aria-hidden="true">
            <PreviewCard.Arrow className="fc-image-preview__arrow" />
            <img
              className="fc-image-preview__image"
              src={src}
              alt=""
              referrerPolicy="no-referrer"
              onError={onError}
            />
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}
