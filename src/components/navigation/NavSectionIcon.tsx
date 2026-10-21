import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { NavSectionIconName } from '@/components/ui/navigation/nav.sections';

type NavSectionIconProps = {
  name: NavSectionIconName;
  size?: number;
  color: string;
};

/** Icons for top-level nav sections (distinct from leaf NavbarIcons). */
export function NavSectionIcon({ name, size = 20, color }: NavSectionIconProps) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
