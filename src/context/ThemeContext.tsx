import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { Palettes, type ColorScheme, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  getThemePreferenceSync,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/utils/theme-storage';

export type { ThemePreference };

type ThemeContextValue = {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => getThemePreferenceSync() ?? 'system',
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void loadThemePreference().then((saved) => {
      if (saved) {
        setPreferenceState(saved);
      }
    });
  }, []);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    void saveThemePreference(nextPreference);
  }, []);

  const colorScheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: Palettes[colorScheme],
      colorScheme,
      preference,
      setPreference,
    }),
    [colorScheme, preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      colors: Palettes.light,
      colorScheme: 'light',
      preference: 'system',
      setPreference: () => {},
    };
  }
  return context;
}
