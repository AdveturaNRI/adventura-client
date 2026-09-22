import { Palettes, type ThemeColors } from '@/constants/theme';

export type MarketingLandingColorMode = 'light' | 'dark';
export type MarketingLandingBackground =
  | 'solid'
  | 'muted'
  | 'soft-blue'
  | 'image';
export type MarketingLandingAccent = 'adventura' | 'indigo' | 'teal';

export type MarketingLandingTheme = {
  mode?: MarketingLandingColorMode;
  background?: MarketingLandingBackground;
  backgroundImageUrl?: string | null;
  accent?: MarketingLandingAccent;
};

export type MarketingLandingThemeTokens = {
  mode: MarketingLandingColorMode;
  background: MarketingLandingBackground;
  backgroundImageUrl: string | null;
  accent: MarketingLandingAccent;
  colors: ThemeColors;
  accentColor: string;
  accentOn: string;
  pageBackground: string;
  pageBackgroundImage: string | null;
  heroBackground: string;
  blockBackground: string;
  blockBorder: string;
  itemBackground: string;
};

const ACCENTS: Record<MarketingLandingAccent, string> = {
  adventura: '#157AFE',
  indigo: '#5856D6',
  teal: '#30B0C7',
};

export function normalizeMarketingLandingTheme(
  raw: MarketingLandingTheme | null | undefined,
): Required<
  Pick<MarketingLandingTheme, 'mode' | 'background' | 'accent'>
> & { backgroundImageUrl: string | null } {
  const mode: MarketingLandingColorMode =
    raw?.mode === 'dark' ? 'dark' : 'light';
  const background: MarketingLandingBackground =
    raw?.background === 'muted' ||
    raw?.background === 'soft-blue' ||
    raw?.background === 'image'
      ? raw.background
      : 'solid';
  const accent: MarketingLandingAccent =
    raw?.accent === 'indigo' || raw?.accent === 'teal'
      ? raw.accent
      : 'adventura';
  const backgroundImageUrl =
    typeof raw?.backgroundImageUrl === 'string' &&
    raw.backgroundImageUrl.trim().length > 0
      ? raw.backgroundImageUrl.trim()
      : null;
  return { mode, background, accent, backgroundImageUrl };
}

export function resolveMarketingLandingTheme(
  raw: MarketingLandingTheme | null | undefined,
): MarketingLandingThemeTokens {
  const normalized = normalizeMarketingLandingTheme(raw);
  const base = Palettes[normalized.mode];
  const accentColor = ACCENTS[normalized.accent];

  let pageBackground = base.background;
  if (normalized.background === 'muted') {
    pageBackground = base.surfaceMuted;
  } else if (normalized.background === 'soft-blue') {
    pageBackground = normalized.mode === 'dark' ? '#0B1220' : '#F2F7FF';
  }

  const pageBackgroundImage =
    normalized.background === 'image' ? normalized.backgroundImageUrl : null;

  return {
    ...normalized,
    colors: {
      ...base,
      primary: accentColor,
      primaryLight: accentColor,
    },
    accentColor,
    accentOn: '#FFFFFF',
    pageBackground,
    pageBackgroundImage,
    heroBackground: accentColor,
    blockBackground: base.surface,
    blockBorder: base.border,
    itemBackground: base.surfaceMuted,
  };
}
