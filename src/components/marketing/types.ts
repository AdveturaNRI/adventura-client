import type { MarketingLandingThemeConfig } from '@/services/marketing/landings';

export type MarketingCta = {
  label?: string;
  url?: string;
};

export type MarketingBlockItem = {
  id?: string;
  title?: string;
  description?: string;
  meta?: string;
  imageUrl?: string;
  icon?: string;
  accentColor?: string;
  url?: string;
};

export type MarketingBlockBase = {
  id?: string;
  title?: string;
  description?: string;
  hidden?: boolean;
  variant?: string;
};

export type HeroBlock = MarketingBlockBase & {
  type: 'hero';
  eyebrow?: string;
  imageUrl?: string;
  imagePosition?: 'right' | 'background' | 'center';
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  trustText?: string;
};

export type FeaturesBlock = MarketingBlockBase & {
  type: 'features';
  columns?: 2 | 3 | 4;
  items?: MarketingBlockItem[];
};

export type AppShowcaseBlock = MarketingBlockBase & {
  type: 'appShowcase';
  imageUrl?: string;
  imageUrlSecondary?: string;
  imageSide?: 'left' | 'right';
  ctaLabel?: string;
  ctaUrl?: string;
};

export type StepsBlock = MarketingBlockBase & {
  type: 'steps';
  items?: MarketingBlockItem[];
};

export type GameFeedBlock = MarketingBlockBase & {
  type: 'gameFeed';
  limit?: number;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type TestimonialsBlock = MarketingBlockBase & {
  type: 'testimonials';
  items?: MarketingBlockItem[];
};

export type ClubFeedBlock = MarketingBlockBase & {
  type: 'clubFeed';
  limit?: number;
  ctaLabel?: string;
  ctaUrl?: string;
};

export type CtaBlock = MarketingBlockBase & {
  type: 'cta';
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
};

export type FaqBlock = MarketingBlockBase & {
  type: 'faq';
  items?: MarketingBlockItem[];
};

export type StatsBlock = MarketingBlockBase & {
  type: 'stats';
  items?: MarketingBlockItem[];
  /** 'manual' | 'api' — api only shows real values if provided by host */
  source?: 'manual' | 'api';
};

export type ContactBlock = MarketingBlockBase & {
  type: 'contact';
  imageUrl?: string;
  telegramUrl?: string;
  email?: string;
  faqAnchor?: string;
};

export type FooterBlock = MarketingBlockBase & {
  type: 'footer';
  logoUrl?: string;
  groups?: {
    id?: string;
    title?: string;
    links?: { label?: string; url?: string }[];
  }[];
  socials?: { label?: string; url?: string }[];
  legalText?: string;
};

export type QuoteBlock = MarketingBlockBase & {
  type: 'quote';
  author?: string;
};

export type MediaBlock = MarketingBlockBase & {
  type: 'media';
  imageUrl?: string;
};

export type MarketingLandingBlock =
  | HeroBlock
  | FeaturesBlock
  | AppShowcaseBlock
  | StepsBlock
  | GameFeedBlock
  | TestimonialsBlock
  | ClubFeedBlock
  | CtaBlock
  | FaqBlock
  | StatsBlock
  | ContactBlock
  | FooterBlock
  | QuoteBlock
  | MediaBlock;

export type MarketingGameCard = {
  id: string;
  title?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  cover?: { url?: string | null } | null;
  systemName?: string | null;
  scheduledAt?: string | null;
  isOnline?: boolean | null;
  city?: { name?: string | null } | null;
  isFree?: boolean | null;
  priceRub?: number | null;
};

export type MarketingClubCard = {
  id: string;
  name?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  address?: string | null;
  city?: { name?: string | null } | null;
};

export type LandingContent = {
  theme?: MarketingLandingThemeConfig & { skin?: 'fantasy' | 'app' };
  blocks?: MarketingLandingBlock[];
};
