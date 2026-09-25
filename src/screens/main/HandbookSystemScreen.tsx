import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HandbookBreadcrumbs } from '@/components/handbook/HandbookBreadcrumbs';
import { HandbookCategoryTile } from '@/components/handbook/HandbookCategoryTile';
import { HandbookEntryCard } from '@/components/handbook/HandbookEntryCard';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import {
  HANDBOOK_CATEGORY_ACCENTS,
  HANDBOOK_CATEGORY_FILTER_LABELS,
  HANDBOOK_CATEGORY_ORDER,
} from '@/data/handbook/labels';
import {
  countEntriesByCategory,
  getHandbookEntriesForSystem,
} from '@/data/handbook/mock-entries';
import { getHandbookSystem } from '@/data/handbook/mock-systems';
import type { HandbookCategory, HandbookCategoryFilter } from '@/data/handbook/types';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  loadHandbookLocation,
  markHandbookHubIntent,
  saveHandbookLocation,
} from '@/utils/handbook-location-storage';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 960;
const TILE_GAP = Spacing.md;

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: Spacing.xs,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 28 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
      maxWidth: 560,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: TILE_GAP,
    },
    tileWrap: {
      flexBasis: isDesktopWeb ? '31.5%' : '47.5%',
      flexGrow: 1,
      maxWidth: isDesktopWeb ? '32.5%' : '49%',
      minWidth: isDesktopWeb ? 200 : 140,
    },
    list: {
      gap: Spacing.md,
    },
    empty: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: FontSize.label * 1.45,
      maxWidth: 360,
    },
    missing: {
      paddingVertical: Spacing.section,
      alignItems: 'center',
      gap: Spacing.sm,
    },
  });
}

function paramToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function HandbookSystemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ systemId?: string | string[] }>();
  const systemId = paramToString(params.systemId);
  const system = getHandbookSystem(systemId);

  const isDesktopWeb = useIsDesktopWeb();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((colors) => createLocalStyles(colors, isDesktopWeb));

  const [category, setCategory] = useState<HandbookCategoryFilter>('all');
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);

    void loadHandbookLocation().then((loc) => {
      if (cancelled) return;
      if (loc.systemId === systemId) {
        setCategory(loc.category);
      } else {
        setCategory('all');
      }
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [systemId]);

  useEffect(() => {
    if (!hydrated || !system) return;
    void saveHandbookLocation({ systemId: system.id, category });
  }, [hydrated, system, category]);

  const categoryCounts = useMemo(() => {
    if (!system) {
      return null;
    }
    return countEntriesByCategory(system.id);
  }, [system]);

  const entries = useMemo(() => {
    if (!system || category === 'all') return [];
    return getHandbookEntriesForSystem(system.id, category);
  }, [system, category]);

  const showCategoryTiles = category === 'all';

  const goToHub = useCallback(() => {
    markHandbookHubIntent();
    router.replace('/handbook');
  }, [router]);

  const resetCategory = useCallback(() => {
    setCategory('all');
  }, []);

  const openCategory = useCallback((next: HandbookCategory) => {
    setCategory(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const onBack = useCallback(() => {
    if (!showCategoryTiles) {
      resetCategory();
      return;
    }
    goToHub();
  }, [showCategoryTiles, resetCategory, goToHub]);

  const breadcrumbItems = useMemo(() => {
    if (!system) {
      return [
        { label: 'Справочник', onPress: goToHub },
        { label: 'Не найдено' },
      ];
    }

    const items: { label: string; onPress?: () => void }[] = [
      { label: 'Справочник', onPress: goToHub },
    ];

    if (!showCategoryTiles) {
      items.push({ label: system.shortName, onPress: resetCategory });
      items.push({ label: HANDBOOK_CATEGORY_FILTER_LABELS[category] });
    } else {
      items.push({ label: system.shortName });
    }

    return items;
  }, [system, category, showCategoryTiles, goToHub, resetCategory]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
  };

  if (!system) {
    return (
      <ScreenTransition>
        <View style={mainStyles.container}>
          <MobileScreenHeader title="Справочник" showBack onBackPress={goToHub} />
          <View style={[mainStyles.content, { paddingTop: Spacing.sm }]}>
            <HandbookBreadcrumbs items={breadcrumbItems} />
            <View style={styles.missing}>
              <Text style={styles.emptyTitle}>Система не найдена</Text>
              <Text style={styles.emptyText}>
                Вернись к списку и выбери систему из плиток.
              </Text>
            </View>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  const headerTitle = showCategoryTiles
    ? system.shortName
    : HANDBOOK_CATEGORY_FILTER_LABELS[category];

  return (
    <ScreenTransition>
      <View style={mainStyles.container}>
        <MobileScreenHeader title={headerTitle} showBack onBackPress={onBack} />

        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={[mainStyles.content, { paddingTop: Spacing.sm }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}>
          <View style={styles.shell}>
            <HandbookBreadcrumbs items={breadcrumbItems} />

            {showCategoryTiles ? (
              <>
                <View style={styles.headerBlock}>
                  <Text style={styles.pageTitle}>{system.name}</Text>
                  <Text style={styles.pageSubtitle}>{system.description}</Text>
                </View>

                <View style={styles.grid}>
                  {HANDBOOK_CATEGORY_ORDER.map((key) => (
                    <View key={key} style={styles.tileWrap}>
                      <HandbookCategoryTile
                        category={key}
                        entryCount={categoryCounts?.[key] ?? 0}
                        accent={HANDBOOK_CATEGORY_ACCENTS[key]}
                        onPress={() => openCategory(key)}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.list}>
                {entries.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>Пока пусто</Text>
                    <Text style={styles.emptyText}>
                      В разделе «{HANDBOOK_CATEGORY_FILTER_LABELS[category]}» ещё нет
                      статей для {system.shortName}.
                    </Text>
                  </View>
                ) : (
                  entries.map((entry) => (
                    <HandbookEntryCard key={entry.id} entry={entry} />
                  ))
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <ScrollToTopButton
          visible={showScrollTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </View>
    </ScreenTransition>
  );
}
