import { useMemo } from 'react';

import { resolveMarketingSkin, type ResolvedMarketingSkin } from '@/components/marketing/theme';
import { useTheme, useThemePreference } from '@/hooks/use-theme';
import type { MarketingLandingThemeConfig } from '@/services/marketing/landings';

export function useLandingSkin(
  theme: (MarketingLandingThemeConfig & { skin?: 'fantasy' | 'app' }) | null | undefined,
): ResolvedMarketingSkin {
  const colors = useTheme();
  const { colorScheme } = useThemePreference();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';

  return useMemo(
    () => resolveMarketingSkin(theme, { scheme, colors }),
    [colors, scheme, theme],
  );
}
