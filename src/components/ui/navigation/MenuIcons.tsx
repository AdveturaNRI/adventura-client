import { SvgXml } from 'react-native-svg';

import { type MenuIconKey } from './menu.config';
import { MENU_ICON_SVGS } from './menu-icon-assets';
import { useTheme } from '@/hooks/use-theme';

type MenuIconProps = {
  name: MenuIconKey;
  size?: number;
};

function tintSvg(xml: string, color: string) {
  return xml
    .replace(/#828282/gi, color)
    .replace(/fill="currentColor"/g, `fill="${color}"`)
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/fill="white"/gi, `fill="${color}"`)
    .replace(/stroke="white"/gi, `stroke="${color}"`);
}

export function MenuIcon({ name, size = 22 }: MenuIconProps) {
  const colors = useTheme();
  const xml = tintSvg(MENU_ICON_SVGS[name], colors.onPrimary);

  return <SvgXml xml={xml} width={size} height={size} />;
}
