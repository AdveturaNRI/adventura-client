import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from 'react';
import { Platform } from 'react-native';
import { Palettes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getThemePreferenceSync, loadThemePreference, saveThemePreference, } from '@/utils/theme-storage';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    const systemScheme = useColorScheme();
    const [preference, setPreferenceState] = useState(() => getThemePreferenceSync() ?? 'system');
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
    const setPreference = useCallback((nextPreference) => {
        setPreferenceState(nextPreference);
        void saveThemePreference(nextPreference);
    }, []);
    const colorScheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') {
            return;
        }
        const root = document.documentElement;
        const body = document.body;
        const bg = colorScheme === 'dark' ? '#000000' : '#FFFFFF';
        const fg = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
        root.style.colorScheme = colorScheme;
        root.dataset.theme = colorScheme;
        root.style.backgroundColor = bg;
        root.style.color = fg;
        if (body) {
            body.style.backgroundColor = bg;
            body.style.color = fg;
            body.style.colorScheme = colorScheme;
        }
    }, [colorScheme]);
    const value = useMemo(() => ({
        colors: Palettes[colorScheme],
        colorScheme,
        preference,
        setPreference,
    }), [colorScheme, preference, setPreference]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useThemeContext() {
    const context = useContext(ThemeContext);
    if (!context) {
        return {
            colors: Palettes.light,
            colorScheme: 'light',
            preference: 'system',
            setPreference: () => { },
        };
    }
    return context;
}
