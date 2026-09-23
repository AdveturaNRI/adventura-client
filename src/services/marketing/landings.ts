import { apiRequest } from '@/services/api/client';

import type { MarketingLandingBlock } from '@/components/marketing/types';

export type { MarketingLandingBlock } from '@/components/marketing/types';

export type MarketingLandingSeo = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  robots?: string | null;
  canonical?: string | null;
};

export type MarketingLandingThemeConfig = {
  mode?: 'light' | 'dark';
  background?: 'solid' | 'muted' | 'soft-blue' | 'image';
  backgroundImageUrl?: string | null;
  accent?: 'adventura' | 'indigo' | 'teal';
  skin?: 'fantasy' | 'app';
};

export type MarketingLanding = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  version: number;
  content: {
    theme?: MarketingLandingThemeConfig;
    blocks?: MarketingLandingBlock[];
  };
  seo: MarketingLandingSeo;
};

export function getPublishedLanding(slug: string) {
  return apiRequest<MarketingLanding>(`/marketing/landings/${encodeURIComponent(slug)}`, {
    skipAuth: true,
    skipAuthRefresh: true,
    skipLoading: true,
  });
}
