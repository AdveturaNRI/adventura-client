import { SvgXml } from 'react-native-svg';

import { NAVBAR_ICON_SVGS, type NavbarIconKey } from './navbar-icon-assets';
import { useTheme } from '@/hooks/use-theme';

type NavbarIconProps = {
  name: NavbarIconKey;
  size?: number;
  active?: boolean;
  /** White icon for blue menu tiles. */
  inverted?: boolean;
};

function tintSvg(xml: string, color: string) {
  return xml
    .replace(/#828282/gi, color)
    .replace(/fill="white"/gi, `fill="${color}"`)
    .replace(/fill="#FFFFFF"/gi, `fill="${color}"`)
    .replace(/stroke="#828282"/gi, `stroke="${color}"`)
    .replace(/stroke="white"/gi, `stroke="${color}"`);
}

export function NavbarIcon({ name, size = 22, active = false, inverted = false }: NavbarIconProps) {
  const colors = useTheme();
  const color = inverted ? colors.onPrimary : active ? colors.primary : colors.textMuted;
  const xml = tintSvg(NAVBAR_ICON_SVGS[name], color);

  return <SvgXml xml={xml} width={size} height={size} />;
}
