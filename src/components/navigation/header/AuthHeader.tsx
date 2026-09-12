import { ScreenHeader } from './ScreenHeader';
import { ThemeToggle } from '@/components/navigation/DesktopThemeToggle';

export function AuthHeader() {
  return <ScreenHeader right={<ThemeToggle />} />;
}
