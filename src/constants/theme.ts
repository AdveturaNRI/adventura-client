export type ThemeColors = {
  primary: string;
  primaryLight: string;
  menuIconBg: string;
  success: string;
  destructive: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderLight: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  onPrimary: string;
  placeholder: string;
  placeholderAlt: string;
  avatar: string;
  overlay: string;
  shadow: string;
  d20Stroke: string;
};

export const Palettes: Record<'light' | 'dark', ThemeColors> = {
  light: {
    primary: '#157AFE',
    primaryLight: '#84B9FF',
    menuIconBg: '#4B99FF',
    success: '#34C759',
    destructive: '#FF3B30',
    text: '#000000',
    textSecondary: '#4C4C4C',
    textMuted: '#727272',
    textSubtle: '#B5B5B5',
    border: '#E8E8E8',
    borderLight: '#F6F6F6',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#FBFBFB',
    onPrimary: '#FFFFFF',
    placeholder: '#F7F7F7',
    placeholderAlt: '#EEEEEE',
    avatar: '#D9D9D9',
    overlay: 'rgba(255,255,255,0.92)',
    shadow: '#000000',
    d20Stroke: '#0E5FD4',
  },
  dark: {
    primary: '#157AFE',
    primaryLight: '#4B99FF',
    menuIconBg: '#4B99FF',
    success: '#34C759',
    destructive: '#FF453A',
    text: '#FFFFFF',
    textSecondary: '#C7C7CC',
    textMuted: '#8E8E93',
    textSubtle: '#636366',
    border: '#38383A',
    borderLight: '#2C2C2E',
    background: '#000000',
    surface: '#1C1C1E',
    surfaceMuted: '#2C2C2E',
    onPrimary: '#FFFFFF',
    placeholder: '#3A3A3C',
    placeholderAlt: '#2C2C2E',
    avatar: '#48484A',
    overlay: 'rgba(28,28,30,0.92)',
    shadow: '#000000',
    d20Stroke: '#84B9FF',
  },
};

export type ColorScheme = keyof typeof Palettes;

/** @deprecated Use `useTheme()` instead */
export const Colors = Palettes.light;

export const Layout = {
  maxContentWidth: 400,
} as const;

export const Sizes = {
  controlHeight: 48,
  badgeHeight: 32,
  progressCircle: 40,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  section: 40,
} as const;

export const Radius = {
  pill: 999,
} as const;

export const FontSize = {
  h1: 28,
  button: 16,
  input: 16,
  label: 14,
  caption: 12,
  link: 14,
  badge: 12,
  badgeLarge: 13,
} as const;
