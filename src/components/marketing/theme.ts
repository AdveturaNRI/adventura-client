import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import type {
  MarketingLandingAccent,
  MarketingLandingBackground,
  MarketingLandingColorMode,
  MarketingLandingTheme,
} from '@/utils/marketing-landing-theme';

/** Marketing / landing skin — separate from app UI palette. */
export const MarketingColors = {
  bg: '#0B111B',
  surface: '#182230',
  surfaceElevated: '#1E2A3A',
  surfaceMuted: '#121A26',
  text: '#FFFFFF',
  textSecondary: '#B7C2D0',
  textMuted: '#7E8B9C',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  accent: '#157AFE',
  accentFantasy: '#9562F5',
  accentWarm: '#FFB866',
  accentPink: '#E85D9A',
  accentTeal: '#30B0C7',
  success: '#34C759',
  onAccent: '#FFFFFF',
  overlay: 'rgba(11,17,27,0.72)',
  overlayHeavy: 'rgba(11,17,27,0.88)',
  glowBlue: 'rgba(21,122,254,0.35)',
  glowPurple: 'rgba(149,98,245,0.35)',
} as const;

export const MarketingLayout = {
  maxWidth: 1200,
  // Blocks are panels, so the rhythm belongs between panels rather than as
  // large empty margins around each one.
  sectionY: 12,
  sectionYMobile: 8,
  gutter: Spacing.md,
  radius: 20,
  radiusSm: 14,
  radiusPill: 999,
  heroMinHeight: 560,
  heroMinHeightMobile: 0,
} as const;

export const MarketingType = {
  hero: { fontSize: 44, lineHeight: 52, fontWeight: '800' as const, letterSpacing: -1 },
  heroMobile: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const, letterSpacing: -0.6 },
  section: { fontSize: 32, lineHeight: 40, fontWeight: '800' as const, letterSpacing: -0.5 },
  sectionMobile: { fontSize: 26, lineHeight: 32, fontWeight: '800' as const, letterSpacing: -0.4 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyLg: { fontSize: 18, lineHeight: 28, fontWeight: '400' as const },
  label: { fontSize: FontSize.label, lineHeight: 20, fontWeight: '700' as const },
  caption: { fontSize: FontSize.caption, lineHeight: 18, fontWeight: '500' as const },
  stat: { fontSize: 40, lineHeight: 46, fontWeight: '800' as const, letterSpacing: -1 },
} as const;

export const FEATURE_ACCENTS = [
  MarketingColors.accentFantasy,
  MarketingColors.accentWarm,
  MarketingColors.accent,
  MarketingColors.success,
  MarketingColors.accentPink,
  MarketingColors.accentTeal,
] as const;

export type ResolvedMarketingSkin = {
  mode: MarketingLandingColorMode;
  background: MarketingLandingBackground;
  backgroundImageUrl: string | null;
  accent: MarketingLandingAccent;
  skin: 'fantasy' | 'app';
  colors: typeof MarketingColors;
  pageBackground: string;
  pageBackgroundImage: string | null;
  accentColor: string;
  accentSecondary: string;
  surface: string;
  surfaceElevated: string;
  /** Translucent so the hero glow shows through. */
  heroPanel: string;
  /** Fill of the secondary button. */
  subtleFill: string;
  text: string;
  textSecondary: string;
  border: string;
};

export type AppThemeForLanding = {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
};

const ACCENTS: Record<MarketingLandingAccent, string> = {
  adventura: MarketingColors.accent,
  indigo: MarketingColors.accentFantasy,
  teal: MarketingColors.accentTeal,
};

/** Default for new landings — fantasy dark from design reference. */
export const DEFAULT_MARKETING_THEME: MarketingLandingTheme & { skin?: 'fantasy' | 'app' } = {
  mode: 'dark',
  background: 'solid',
  accent: 'adventura',
  skin: 'fantasy',
};

/** For content over a dark scrim (cover image, CTA banner): light text in any app theme. */
export function onDarkScrimSkin(skin: ResolvedMarketingSkin): ResolvedMarketingSkin {
  if (skin.mode === 'dark') return skin;
  return {
    ...skin,
    mode: 'dark',
    skin: 'fantasy',
    surface: MarketingColors.surface,
    surfaceElevated: MarketingColors.surfaceElevated,
    heroPanel: 'rgba(13, 23, 37, 0.78)',
    subtleFill: 'rgba(255,255,255,0.08)',
    text: MarketingColors.text,
    textSecondary: MarketingColors.textSecondary,
    border: MarketingColors.borderStrong,
  };
}

/**
 * With `app` the landing follows the app light/dark mode: light uses the app
 * palette, dark keeps the navy landing palette (pure app black looks flat on
 * big marketing panels). Accent and background image come from the landing.
 */
export function resolveMarketingSkin(
  raw: (MarketingLandingTheme & { skin?: 'fantasy' | 'app' }) | null | undefined,
  app?: AppThemeForLanding,
): ResolvedMarketingSkin {
  const mode: MarketingLandingColorMode = raw?.mode === 'light' ? 'light' : 'dark';
  const background: MarketingLandingBackground =
    raw?.background === 'muted' ||
    raw?.background === 'soft-blue' ||
    raw?.background === 'image'
      ? raw.background
      : 'solid';
  const accent: MarketingLandingAccent =
    raw?.accent === 'indigo' || raw?.accent === 'teal' ? raw.accent : 'adventura';
  const skin = raw?.skin === 'app' ? 'app' : 'fantasy';
  const backgroundImageUrl =
    typeof raw?.backgroundImageUrl === 'string' && raw.backgroundImageUrl.trim()
      ? raw.backgroundImageUrl.trim()
      : null;

  const accentColor = ACCENTS[accent];

  if (app?.scheme === 'light') {
    return {
      mode: 'light',
      background,
      backgroundImageUrl,
      accent,
      skin: 'app',
      colors: MarketingColors,
      pageBackground: app.colors.background,
      pageBackgroundImage: background === 'image' ? backgroundImageUrl : null,
      accentColor,
      accentSecondary: MarketingColors.accentFantasy,
      surface: app.colors.surface,
      surfaceElevated: app.colors.surfaceMuted,
      heroPanel: `${app.colors.surface}D9`,
      subtleFill: 'rgba(0,0,0,0.04)',
      text: app.colors.text,
      textSecondary: app.colors.textSecondary,
      border: app.colors.border,
    };
  }

  if (!app && skin === 'app' && mode === 'light') {
    return {
      mode,
      background,
      backgroundImageUrl,
      accent,
      skin,
      colors: MarketingColors,
      pageBackground:
        background === 'soft-blue'
          ? '#F2F7FF'
          : background === 'muted'
            ? '#FBFBFB'
            : '#FFFFFF',
      pageBackgroundImage: background === 'image' ? backgroundImageUrl : null,
      accentColor,
      accentSecondary: MarketingColors.accentFantasy,
      surface: '#FFFFFF',
      surfaceElevated: '#F7F9FC',
      heroPanel: 'rgba(255,255,255,0.85)',
      subtleFill: 'rgba(0,0,0,0.04)',
      text: '#000000',
      textSecondary: '#4C4C4C',
      border: '#E8E8E8',
    };
  }

  let pageBackground: string = MarketingColors.bg;
  if (background === 'muted') pageBackground = MarketingColors.surfaceMuted;
  if (background === 'soft-blue') pageBackground = '#0B1220';

  return {
    mode: 'dark',
    background,
    backgroundImageUrl,
    accent,
    skin: 'fantasy',
    colors: MarketingColors,
    pageBackground,
    pageBackgroundImage: background === 'image' ? backgroundImageUrl : null,
    accentColor,
    accentSecondary: MarketingColors.accentFantasy,
    surface: MarketingColors.surface,
    surfaceElevated: MarketingColors.surfaceElevated,
    heroPanel: 'rgba(13, 23, 37, 0.78)',
    subtleFill: 'rgba(255,255,255,0.08)',
    text: MarketingColors.text,
    textSecondary: MarketingColors.textSecondary,
    border: MarketingColors.border,
  };
}
