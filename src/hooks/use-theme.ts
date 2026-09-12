import { useThemeContext } from '@/context/ThemeContext';
import { type ThemeColors } from '@/constants/theme';

export function useTheme(): ThemeColors {
  return useThemeContext().colors;
}

export function useThemePreference() {
  const { colorScheme, preference, setPreference } = useThemeContext();
  return { colorScheme, preference, setPreference };
}
