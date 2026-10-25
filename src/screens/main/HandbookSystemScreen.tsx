import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { HandbookBreadcrumbs } from '@/components/handbook/HandbookBreadcrumbs';
import { HandbookCategoryTile } from '@/components/handbook/HandbookCategoryTile';
import { HandbookEntryCard } from '@/components/handbook/HandbookEntryCard';
import { HandbookEntryTile } from '@/components/handbook/HandbookEntryTile';
import { HandbookRaceTile } from '@/components/handbook/HandbookRaceTile';
import { HandbookRaceVariantsSheet } from '@/components/handbook/HandbookRaceVariantsSheet';
import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { toast } from '@/components/ui/feedback/toast';
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
import type {
  HandbookCategory,
  HandbookCategoryFilter,
  HandbookEntry,
} from '@/data/handbook/types';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  loadHandbookLocation,
  markHandbookHubIntent,
  saveHandbookLocation,
} from '@/utils/handbook-location-storage';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 960;
/** Расы — плотнее, как на dnd.su. */
const RACES_CONTENT_MAX = 1180;
const DESKTOP_SIDEBAR_WIDTH = 268;
const TILE_GAP = Spacing.md;
const RACE_TILE_GAP = Spacing.sm;

/** Сколько колонок влезает в контент (сайдбар + паддинги). */
function gridColumns(
  windowWidth: number,
  sidebarVisible: boolean,
  minColWidth: number,
  {
    maxCols = 3,
    contentMax = DESKTOP_CONTENT_MAX,
    gap = TILE_GAP,
  }: { maxCols?: number; contentMax?: number; gap?: number } = {},
): number {
  const chrome = (sidebarVisible ? DESKTOP_SIDEBAR_WIDTH : 0) + Spacing.lg * 4;
  const avail = Math.max(280, Math.min(contentMax, windowWidth - chrome));
  return Math.max(1, Math.min(maxCols, Math.floor((avail + gap) / (minColWidth + gap))));
}

function colWidth(contentWidth: number, cols: number, gap = TILE_GAP): number {
  return Math.floor((contentWidth - gap * Math.max(0, cols - 1)) / cols);
}

function createLocalStyles(
  colors: ThemeColors,
  isDesktopWeb: boolean,
  contentWidth: number,
  racesContentWidth: number,
  raceCols: number,
  classCols: number,
  categoryCols: number,
  isRaces: boolean,
) {
  const raceW = colWidth(racesContentWidth, raceCols, RACE_TILE_GAP);
  const classW = colWidth(contentWidth, classCols);
  const catW = colWidth(contentWidth, categoryCols);
  const shellMax = isRaces ? RACES_CONTENT_MAX : DESKTOP_CONTENT_MAX;

  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? shellMax : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md,
      paddingBottom: Spacing.xl,
      minWidth: 0,
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
      width: '100%',
      maxWidth: contentWidth,
      minWidth: 0,
      alignSelf: 'stretch',
    },
    raceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: RACE_TILE_GAP,
      width: '100%',
      maxWidth: racesContentWidth,
      minWidth: 0,
      alignSelf: 'stretch',
    },
    tileWrap: {
      width: catW,
      maxWidth: catW,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 0,
    },
    classTileWrap: {
      width: classW,
      maxWidth: classW,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 0,
    },
    raceTileWrap: {
      width: raceW,
      maxWidth: raceW,
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 0,
      // Одна высота в ряду: карточка растягивается на wrap.
      alignSelf: 'stretch',
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
  const sidebarVisible = useIsDesktopSidebarVisible();
  const { width: windowWidth } = useWindowDimensions();
  const [category, setCategory] = useState<HandbookCategoryFilter>('all');
  const [hydrated, setHydrated] = useState(false);
  const [variantsRaceId, setVariantsRaceId] = useState<string | null>(null);

  const contentWidth = Math.max(
    280,
    Math.min(
      DESKTOP_CONTENT_MAX,
      windowWidth - (sidebarVisible ? DESKTOP_SIDEBAR_WIDTH : 0) - Spacing.lg * 4,
    ),
  );
  const racesContentWidth = Math.max(
    280,
    Math.min(
      RACES_CONTENT_MAX,
      windowWidth - (sidebarVisible ? DESKTOP_SIDEBAR_WIDTH : 0) - Spacing.lg * 4,
    ),
  );
  // Шире колонки — длинные названия вроде «Драконорождённый» без разрыва слова.
  const raceCols = gridColumns(windowWidth, sidebarVisible, isDesktopWeb ? 300 : 320, {
    maxCols: 3,
    contentMax: RACES_CONTENT_MAX,
    gap: RACE_TILE_GAP,
  });
  const classCols = isDesktopWeb
    ? gridColumns(windowWidth, sidebarVisible, 160)
    : Math.min(2, gridColumns(windowWidth, false, 140));
  const categoryCols = isDesktopWeb
    ? gridColumns(windowWidth, sidebarVisible, 200)
    : Math.min(2, gridColumns(windowWidth, false, 140));
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((colors) =>
    createLocalStyles(
      colors,
      isDesktopWeb,
      contentWidth,
      racesContentWidth,
      raceCols,
      classCols,
      categoryCols,
      category === 'races',
    ),
  );
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
    setVariantsRaceId(null);
    setCategory('all');
  }, []);

  const openCategory = useCallback((next: HandbookCategory) => {
    setVariantsRaceId(null);
    setCategory(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const openRaceEntry = useCallback((entry: HandbookEntry) => {
    setVariantsRaceId(null);
    // Страница статьи расы ещё не готова — пока подтверждаем выбор.
    toast.info(entry.title);
  }, []);

  const variantsRace = useMemo(
    () => entries.find((e) => e.id === variantsRaceId) ?? null,
    [entries, variantsRaceId],
  );

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
            ) : category === 'races' ? (
              <>
                <View style={styles.raceGrid}>
                  {entries.map((entry) => {
                    const hasVariants = (entry.variants?.length ?? 0) > 0;
                    return (
                      <View key={entry.id} style={styles.raceTileWrap}>
                        <HandbookRaceTile
                          entry={entry}
                          onPress={() => openRaceEntry(entry)}
                          onOpenVariants={
                            hasVariants ? () => setVariantsRaceId(entry.id) : undefined
                          }
                        />
                      </View>
                    );
                  })}
                </View>
                <HandbookRaceVariantsSheet
                  race={variantsRace}
                  visible={variantsRace != null}
                  onClose={() => setVariantsRaceId(null)}
                  onSelect={openRaceEntry}
                />
              </>
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
