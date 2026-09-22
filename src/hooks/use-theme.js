import { useThemeContext } from '@/context/ThemeContext';
export function useTheme() {
    return useThemeContext().colors;
}
export function useThemePreference() {
    const { colorScheme, preference, setPreference } = useThemeContext();
    return { colorScheme, preference, setPreference };
}
