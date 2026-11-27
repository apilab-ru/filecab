/** Supplies an image and the class that sizes its cropped thumbnail. */
export interface ImagePreviewProps {
  src: string;
  className: string;
  onError: () => void;
}
