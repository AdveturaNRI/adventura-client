import { SvgXml } from 'react-native-svg';

import {
  USER_CARD_ICON_SVGS,
  type UserCardIconKey,
} from '@/components/ui/cards/user-card-icon-assets';
import { useTheme } from '@/hooks/use-theme';

type UserCardIconProps = {
  name: UserCardIconKey;
  size?: number;
};

function tintUserCardIcon(xml: string, color: string) {
  return xml
    .replace(/#828282/gi, color)
    .replace(/#636363/gi, color)
    .replace(/fill="currentColor"/g, `fill="${color}"`)
    .replace(/stroke="currentColor"/g, `stroke="${color}"`);
}

export function UserCardIcon({ name, size = 20 }: UserCardIconProps) {
  const colors = useTheme();
  const xml = tintUserCardIcon(USER_CARD_ICON_SVGS[name], colors.textMuted);

  return <SvgXml xml={xml} width={size} height={size} />;
}
