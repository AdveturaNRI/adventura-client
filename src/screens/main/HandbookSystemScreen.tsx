import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
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
import { HandbookEntryTile } from '@/components/handbook/HandbookEntryTile';
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
  HANDBOOK_CATEGORY_ORDER,
  getHandbookCategoryFilterLabel,
} from '@/data/handbook/labels';
import { getHandbookEntriesForSystem } from '@/data/handbook/mock-entries';
import { getHandbookSystem, resolveHandbookSystemId } from '@/data/handbook/mock-systems';
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
      minWidth: isDesktopWeb ? 160 : 120,
    },
    classTileWrap: {
      flexBasis: isDesktopWeb ? '23%' : '47.5%',
      flexGrow: 1,
      maxWidth: isDesktopWeb ? '24.5%' : '49%',
      minWidth: isDesktopWeb ? 140 : 108,
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
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ systemId?: string | string[] }>();
  const rawSystemId = paramToString(params.systemId);
  const systemId = resolveHandbookSystemId(rawSystemId);
  const system = getHandbookSystem(systemId);

  const isDesktopWeb = useIsDesktopWeb();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((colors) => createLocalStyles(colors, isDesktopWeb));

  const [category, setCategory] = useState<HandbookCategoryFilter>('all');
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const categoryRef = useRef(category);
  categoryRef.current = category;

  useEffect(() => {
    if (rawSystemId && rawSystemId !== systemId) {
      router.replace(`/handbook/${systemId}`);
    }
  }, [rawSystemId, router, systemId]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);

    void loadHandbookLocation().then((loc) => {
      if (cancelled) return;
      if (loc.systemId === systemId && loc.category !== 'rules') {
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

  const entries = useMemo(() => {
    if (!system || category === 'all') return [];
    return getHandbookEntriesForSystem(system.id, category);
  }, [system, category]);

  const showCategoryTiles = category === 'all';

  const leaveToHub = useCallback(() => {
    markHandbookHubIntent();
    void saveHandbookLocation({ systemId: null, category: 'all' });
    const stackIndex = navigation.getState()?.index ?? 0;
    if (stackIndex > 0) {
      router.back();
      return;
    }
    router.replace('/handbook');
  }, [navigation, router]);

  const goToHub = leaveToHub;

  const resetCategory = useCallback(() => {
    setCategory('all');
  }, []);

  const openCategory = useCallback((next: HandbookCategory) => {
    setCategory(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const onBack = useCallback(() => {
    if (categoryRef.current !== 'all') {
      resetCategory();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    leaveToHub();
  }, [resetCategory, leaveToHub]);

  // Свайп/кнопка «назад»: сначала раздел → обзор системы → хаб, не выход из Библиотеки.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (event) => {
      const actionType = event.data.action.type;
      if (actionType !== 'GO_BACK' && actionType !== 'POP' && actionType !== 'POP_TO_TOP') {
        return;
      }

      if (categoryRef.current !== 'all') {
        event.preventDefault();
        setCategory('all');
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        return;
      }

      markHandbookHubIntent();
      void saveHandbookLocation({ systemId: null, category: 'all' });

      const stackIndex = navigation.getState()?.index ?? 0;
      if (stackIndex > 0) {
        return;
      }

      event.preventDefault();
      router.replace('/handbook');
    });

    return unsub;
  }, [navigation, router]);

  const breadcrumbItems = useMemo(() => {
    if (!system) {
      return [
        { label: 'Библиотека', onPress: goToHub },
        { label: 'Не найдено' },
      ];
    }

    const items: { label: string; onPress?: () => void }[] = [
      { label: 'Библиотека', onPress: goToHub },
    ];

    if (!showCategoryTiles) {
      items.push({ label: system.shortName, onPress: resetCategory });
      items.push({ label: getHandbookCategoryFilterLabel(category, system.id) });
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
          <MobileScreenHeader title="Библиотека" showBack onBackPress={goToHub} />
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
    : getHandbookCategoryFilterLabel(category, system.id);

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
                        systemId={system.id}
                        accent={HANDBOOK_CATEGORY_ACCENTS[key]}
                        onPress={() => openCategory(key)}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Пока пусто</Text>
                <Text style={styles.emptyText}>
                  В разделе «{getHandbookCategoryFilterLabel(category, system.id)}» ещё нет
                  статей для {system.shortName}.
                </Text>
              </View>
            ) : category === 'classes' ? (
              <View style={styles.grid}>
                {entries.map((entry) => (
                  <View key={entry.id} style={styles.classTileWrap}>
                    <HandbookEntryTile entry={entry} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.list}>
                {entries.map((entry) => (
                  <HandbookEntryCard key={entry.id} entry={entry} />
                ))}
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
