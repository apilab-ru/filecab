import './button.scss';

import { Button as BaseButton } from '@base-ui/react/button';
import type { ButtonProps } from './model-button';

/** Provides the shared accessible button appearance and behavior. */
export function Button({ className = '', ...props }: ButtonProps) {
  return <BaseButton className={`fc-button ${className}`} {...props} />;
}
