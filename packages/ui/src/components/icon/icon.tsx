import './icon.scss';

import { useContext } from 'react';
import { IconBase } from '../../models/icon-context';
import { IconName } from '../../models/icon-name';
import { ASSETS, type IconProps } from './model-icon';

/** Colors the supplied SVG silhouette with the control's foreground color. */
export function Icon({ name }: IconProps) {
  const base = useContext(IconBase);
  const url = base ? `${base}${name}.svg` : ASSETS[name];

  return (
    <span
      className="fc-icon"
      data-icon={name}
      aria-hidden="true"
      style={{ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }}
    />
  );
}
