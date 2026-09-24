import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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

function applyDocumentTheme(colorScheme: ColorScheme) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  const body = document.body;
  const palette = Palettes[colorScheme];
  const bg = palette.background;
  const fg = palette.text;
  root.style.colorScheme = colorScheme;
  root.dataset.theme = colorScheme;
  root.style.backgroundColor = bg;
  root.style.color = fg;
  root.style.setProperty('--adventura-toast-bg', palette.surface);
  root.style.setProperty('--adventura-toast-fg', palette.text);
  root.style.setProperty('--adventura-toast-muted', palette.textSecondary);
  root.style.setProperty('--adventura-toast-border', palette.border);
  root.style.setProperty(
    '--adventura-toast-action-bg',
    colorScheme === 'dark' ? 'rgba(21, 122, 254, 0.22)' : 'rgba(21, 122, 254, 0.12)',
  );
  root.style.setProperty(
    '--adventura-toast-action-fg',
    colorScheme === 'dark' ? palette.primaryLight : palette.primary,
  );
  root.style.setProperty('--adventura-notif-bg', palette.surface);
  root.style.setProperty('--adventura-notif-fg', palette.text);
  root.style.setProperty('--adventura-notif-muted', palette.textMuted);
  root.style.setProperty('--adventura-notif-border', palette.borderLight);
  root.style.setProperty('--adventura-notif-action', '#9A7518');
  if (body) {
    body.style.backgroundColor = bg;
    body.style.color = fg;
    body.style.colorScheme = colorScheme;
  }
}

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

  // Before paint — so toast CSS never sees a stale data-theme="light" on a dark UI.
  useLayoutEffect(() => {
    applyDocumentTheme(colorScheme);
  }, [colorScheme]);

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
