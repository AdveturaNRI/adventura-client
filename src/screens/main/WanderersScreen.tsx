import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { WanderersFiltersPanel } from '@/components/wanderers/WanderersFiltersPanel';
import type { SwitcherOption } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { WandererDeck } from '@/screens/main/WandererDeck';
import { WANDERERS_SCREEN } from '@/screens/main/profile.config';
import {
  fetchWandererBucketCounts,
  fetchWanderers,
  type WandererBucket,
  type WandererBucketCounts,
  type WandererCardItem,
  type WandererReactionType,
} from '@/services/profile/wanderersApi';
import { fetchExperienceTypes, fetchGameSystems } from '@/services/reference/referenceApi';
import { localizeErrorMessage } from '@/utils/localizeError';
import {
  applyWanderersFilters,
  buildWanderersFilterOptions,
  EMPTY_WANDERERS_FILTERS,
  loadWanderersFilters,
  saveWanderersFilters,
  type WanderersFilters,
} from '@/utils/wanderers-filters';

import { useMainScreenStyles } from './main-screen.styles';

const BUCKET_OPTIONS = [
  { key: 'feed', label: WANDERERS_SCREEN.bucketFeed, icon: 'albums-outline' as const },
  { key: 'favorites', label: WANDERERS_SCREEN.bucketFavorites, icon: 'crown-outline', iconSet: 'material-community' as const },
  { key: 'skipped', label: WANDERERS_SCREEN.bucketSkipped, icon: 'eye-off-outline' as const },
];

const EMPTY_BUCKET_COUNTS: WandererBucketCounts = {
  favorites: 0,
  skipped: 0,
};

export default function WanderersScreen() {
  const styles = useMainScreenStyles();
  const colors = useTheme();
  const { user } = useAuth();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const showCompactNav = !hasDesktopSidebar;
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltersReady, setIsFiltersReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bucket, setBucket] = useState<WandererBucket>('feed');
  const [items, setItems] = useState<WandererCardItem[]>([]);
  const [bucketCounts, setBucketCounts] = useState<WandererBucketCounts>(EMPTY_BUCKET_COUNTS);
  const [filters, setFilters] = useState<WanderersFilters>(EMPTY_WANDERERS_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [officialSystems, setOfficialSystems] = useState<string[]>([]);
  const [experienceLabels, setExperienceLabels] = useState<string[]>([]);

  const loadBucketCounts = useCallback(async () => {
    try {
      const counts = await fetchWandererBucketCounts();
      setBucketCounts(counts);
    } catch {
      setBucketCounts(EMPTY_BUCKET_COUNTS);
    }
  }, []);

  const loadWanderers = useCallback(async (nextBucket: WandererBucket) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextItems] = await Promise.all([
        fetchWanderers(nextBucket),
        loadBucketCounts(),
      ]);
      setItems(nextItems);
    } catch (error) {
      setItems([]);
      setErrorMessage(localizeErrorMessage(error, WANDERERS_SCREEN.loadError));
    } finally {
      setIsLoading(false);
    }
  }, [loadBucketCounts]);

  useEffect(() => {
    void loadWanderers(bucket);
  }, [bucket, loadWanderers]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [stored, experienceTypes, gameSystems] = await Promise.all([
        loadWanderersFilters(),
        fetchExperienceTypes().catch(() => []),
        fetchGameSystems().catch(() => []),
      ]);

      if (cancelled) {
        return;
      }

      setFilters(stored);
      setExperienceLabels(experienceTypes.map((item) => item.name));
      setOfficialSystems(
        gameSystems.filter((item) => item.isOfficial).map((item) => item.name),
      );
      setIsFiltersReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const bucketOptions = useMemo<SwitcherOption[]>(
    () =>
      BUCKET_OPTIONS.map((option) => ({
        ...option,
        badge:
          option.key === 'favorites'
            ? bucketCounts.favorites
            : option.key === 'skipped'
              ? bucketCounts.skipped
              : undefined,
      })),
    [bucketCounts.favorites, bucketCounts.skipped],
  );

  const visibleItems = useMemo(() => {
    if (bucket !== 'feed' || !user?.id) {
      return items;
    }

    return items.filter((item) => item.id !== user.id);
  }, [bucket, items, user?.id]);

  const filterOptions = useMemo(
    () =>
      buildWanderersFilterOptions({
        items: visibleItems,
        officialSystems,
        experiences: experienceLabels,
      }),
    [experienceLabels, officialSystems, visibleItems],
  );

  const filteredItems = useMemo(
    () => applyWanderersFilters(visibleItems, filters),
    [filters, visibleItems],
  );

  const filtersSignature = useMemo(() => JSON.stringify(filters), [filters]);

  const handleFiltersChange = useCallback((next: WanderersFilters) => {
    setFilters(next);
    void saveWanderersFilters(next);
  }, []);

  const handleFiltersClear = useCallback(() => {
    handleFiltersChange({
      ...EMPTY_WANDERERS_FILTERS,
      availability: { ...EMPTY_WANDERERS_FILTERS.availability },
    });
  }, [handleFiltersChange]);

  const handleBucketChange = useCallback((nextBucket: WandererBucket) => {
    setBucket(nextBucket);
  }, []);

  const handleRestart = useCallback(() => {
    void loadWanderers(bucket);
  }, [bucket, loadWanderers]);

  const handleReactionSaved = useCallback(
    (targetUserId: string, type: WandererReactionType) => {
      if (bucket === 'feed') {
        setItems((prev) => prev.filter((item) => item.id !== targetUserId));
        setBucketCounts((prev) => ({
          favorites: type === 'favorite' ? prev.favorites + 1 : prev.favorites,
          skipped: type === 'skipped' ? prev.skipped + 1 : prev.skipped,
        }));
        return;
      }

      if (bucket === 'favorites') {
        setItems((prev) => prev.filter((item) => item.id !== targetUserId));
        if (type === 'skipped') {
          setBucketCounts((prev) => ({
            favorites: Math.max(0, prev.favorites - 1),
            skipped: prev.skipped + 1,
          }));
        }
        return;
      }

      if (bucket === 'skipped' && type === 'favorite') {
        setItems((prev) => prev.filter((item) => item.id !== targetUserId));
        setBucketCounts((prev) => ({
          favorites: prev.favorites + 1,
          skipped: Math.max(0, prev.skipped - 1),
        }));
      }
    },
    [bucket],
  );

  const handleReactionCleared = useCallback(
    (targetUserId: string, previousType: WandererReactionType) => {
      setBucketCounts((prev) => ({
        favorites:
          previousType === 'favorite'
            ? Math.max(0, prev.favorites - 1)
            : prev.favorites,
        skipped:
          previousType === 'skipped'
            ? Math.max(0, prev.skipped - 1)
            : prev.skipped,
      }));

      if (bucket === 'feed') {
        void loadWanderers('feed');
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== targetUserId));
    },
    [bucket, loadWanderers],
  );

  const filtersPanel = isFiltersReady ? (
    <WanderersFiltersPanel
      filters={filters}
      options={filterOptions}
      expanded={filtersExpanded}
      onExpandedChange={setFiltersExpanded}
      onChange={handleFiltersChange}
      onClear={handleFiltersClear}
      bucket={bucket}
      bucketOptions={bucketOptions}
      onBucketChange={handleBucketChange}
      bucketDisabled={isLoading}
    />
  ) : null;

  if ((isLoading && items.length === 0) || !isFiltersReady) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={[styles.container, styles.stateWrap]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenTransition>
    );
  }

  if (errorMessage && items.length === 0) {
    return (
      <ScreenTransition animateOnFocus>
        <View style={styles.container}>
          {showCompactNav ? (
            <MobileScreenHeader title={WANDERERS_SCREEN.title} />
          ) : (
            <Text style={styles.title}>{WANDERERS_SCREEN.title}</Text>
          )}
          {filtersPanel}
          <Text style={styles.stateText}>{errorMessage}</Text>
        </View>
      </ScreenTransition>
    );
  }

  const sourceEmpty = visibleItems.length === 0;

  return (
    <ScreenTransition animateOnFocus>
      <WandererDeck
        items={filteredItems}
        bucket={bucket}
        filtersSignature={filtersSignature}
        feedSourceEmpty={sourceEmpty}
        filtersSlot={filtersPanel}
        onRestart={handleRestart}
        onReactionSaved={handleReactionSaved}
        onReactionCleared={handleReactionCleared}
        onUnblocked={(targetUserId) => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === targetUserId ? { ...item, blockedByMe: false } : item,
            ),
          );
        }}
      />
    </ScreenTransition>
  );
}
