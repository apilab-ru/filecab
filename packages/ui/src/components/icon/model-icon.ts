import type { IconName } from '../../models/icon-name';

export interface IconProps {
  name: IconName;
}

export const ASSETS: Record<IconName, string> = {
  library: new URL('../../assets/icons/library.svg', import.meta.url).href,
  search: new URL('../../assets/icons/search.svg', import.meta.url).href,
  settings: new URL('../../assets/icons/settings.svg', import.meta.url).href,
  'external-link': new URL('../../assets/icons/external-link.svg', import.meta.url).href,
  grid: new URL('../../assets/icons/grid.svg', import.meta.url).href,
  list: new URL('../../assets/icons/list.svg', import.meta.url).href,
  plus: new URL('../../assets/icons/plus.svg', import.meta.url).href,
  'chevron-left': new URL('../../assets/icons/chevron-left.svg', import.meta.url).href,
  'chevron-right': new URL('../../assets/icons/chevron-right.svg', import.meta.url).href,
  globe: new URL('../../assets/icons/globe.svg', import.meta.url).href,
  sun: new URL('../../assets/icons/sun.svg', import.meta.url).href,
  moon: new URL('../../assets/icons/moon.svg', import.meta.url).href,
  'refresh-cw': new URL('../../assets/icons/refresh-cw.svg', import.meta.url).href,
  'circle-check': new URL('../../assets/icons/circle-check.svg', import.meta.url).href,
  'arrow-left': new URL('../../assets/icons/arrow-left.svg', import.meta.url).href,
  star: new URL('../../assets/icons/star.svg', import.meta.url).href,
  'star-outline': new URL('../../assets/icons/star-outline.svg', import.meta.url).href,
  link: new URL('../../assets/icons/link.svg', import.meta.url).href,
  minus: new URL('../../assets/icons/minus.svg', import.meta.url).href,
  ellipsis: new URL('../../assets/icons/ellipsis.svg', import.meta.url).href,
  'arrow-left-right': new URL('../../assets/icons/arrow-left-right.svg', import.meta.url).href,
  'chevron-down': new URL('../../assets/icons/chevron-down.svg', import.meta.url).href,
  'status-dot': new URL('../../assets/icons/status-dot.svg', import.meta.url).href,
};
