import { ScreenHeader } from './ScreenHeader';
import { ThemeToggle } from '@/components/navigation/DesktopThemeToggle';

export function MainHeader() {
  return <ScreenHeader right={<ThemeToggle />} />;
}
