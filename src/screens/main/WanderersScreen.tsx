import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { WanderersFiltersPanel } from '@/components/wanderers/WanderersFiltersPanel';
import type { SwitcherOption } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { WandererDeck } from '@/screens/main/WandererDeck';
import { WANDERERS_SCREEN } from '@/screens/main/profile.config';
import {
  fetchWandererBucketCounts,
  fetchWanderers,
  searchWanderers,
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

const BUCKET_OPTIONS = [
  { key: 'feed', label: WANDERERS_SCREEN.bucketFeed, icon: 'albums-outline' as const },
  { key: 'favorites', label: WANDERERS_SCREEN.bucketFavorites, icon: 'crown-outline', iconSet: 'material-community' as const },
  { key: 'skipped', label: WANDERERS_SCREEN.bucketSkipped, icon: 'eye-off-outline' as const },
];

const EMPTY_BUCKET_COUNTS: WandererBucketCounts = {
  favorites: 0,
  skipped: 0,
};

const NICKNAME_SEARCH_MIN = 1;
const NICKNAME_SEARCH_DEBOUNCE_MS = 300;

export default function WanderersScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltersReady, setIsFiltersReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bucket, setBucket] = useState<WandererBucket>('feed');
  const [items, setItems] = useState<WandererCardItem[]>([]);
  const [bucketCounts, setBucketCounts] = useState<WandererBucketCounts>(EMPTY_BUCKET_COUNTS);
  const [filters, setFilters] = useState<WanderersFilters>(EMPTY_WANDERERS_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [nicknameQuery, setNicknameQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WandererCardItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [officialSystems, setOfficialSystems] = useState<string[]>([]);
  const [experienceLabels, setExperienceLabels] = useState<string[]>([]);
  const loadGenerationRef = useRef(0);
  const searchGenerationRef = useRef(0);
  const feedRemovedCardsRef = useRef(new Map<string, WandererCardItem>());
  const browseSkippedCardsRef = useRef(new Map<string, WandererCardItem>());

  const trimmedNicknameQuery = nicknameQuery.trim();
  const searchActive = trimmedNicknameQuery.length >= NICKNAME_SEARCH_MIN;

  const loadBucketCounts = useCallback(async () => {
    try {
      const counts = await fetchWandererBucketCounts();
      setBucketCounts(counts);
    } catch {
      setBucketCounts(EMPTY_BUCKET_COUNTS);
    }
  }, []);

  const loadWanderers = useCallback(async (nextBucket: WandererBucket) => {
    const generation = ++loadGenerationRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextItems] = await Promise.all([
        fetchWanderers(nextBucket),
        loadBucketCounts(),
      ]);
      if (generation !== loadGenerationRef.current) {
        return;
      }
      if (nextBucket === 'feed') {
        feedRemovedCardsRef.current.clear();
        browseSkippedCardsRef.current.clear();
      }
      setItems(nextItems);
    } catch (error) {
      if (generation !== loadGenerationRef.current) {
        return;
      }
      setItems([]);
      setErrorMessage(localizeErrorMessage(error, WANDERERS_SCREEN.loadError));
    } finally {
      if (generation === loadGenerationRef.current) {
        setIsLoading(false);
      }
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

  useEffect(() => {
    if (!searchActive) {
      searchGenerationRef.current += 1;
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    const generation = ++searchGenerationRef.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchWanderers(trimmedNicknameQuery);
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setSearchResults(results);
        } catch (error) {
          if (generation !== searchGenerationRef.current) {
            return;
          }
          setSearchResults([]);
          setSearchError(localizeErrorMessage(error, WANDERERS_SCREEN.searchError));
        } finally {
          if (generation === searchGenerationRef.current) {
            setIsSearching(false);
          }
        }
      })();
    }, NICKNAME_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [searchActive, trimmedNicknameQuery]);

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

  const filtersSignature = useMemo(
    () => `${JSON.stringify(filters)}|search:${searchActive ? '1' : '0'}`,
    [filters, searchActive],
  );

  const deckItems = searchActive ? searchResults : filteredItems;

  const restoreBrowsedCards = useCallback(() => {
    if (browseSkippedCardsRef.current.size === 0) {
      return;
    }

    setItems((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const restored = [...browseSkippedCardsRef.current.values()].filter(
        (item) => !existing.has(item.id),
      );
      browseSkippedCardsRef.current.clear();
      if (restored.length === 0) {
        return prev;
      }
      return [...restored, ...prev];
    });
  }, []);

  const handleFiltersChange = useCallback(
    (next: WanderersFilters) => {
      restoreBrowsedCards();
      setFilters(next);
      void saveWanderersFilters(next);
    },
    [restoreBrowsedCards],
  );

  const handleFiltersClear = useCallback(() => {
    handleFiltersChange({
      ...EMPTY_WANDERERS_FILTERS,
      availability: { ...EMPTY_WANDERERS_FILTERS.availability },
    });
  }, [handleFiltersChange]);

  const handleBucketChange = useCallback(
    (nextBucket: WandererBucket) => {
      if (nextBucket === bucket) {
        return;
      }
      setNicknameQuery('');
      setBucket(nextBucket);
      setItems([]);
      setIsLoading(true);
      setErrorMessage(null);
    },
    [bucket],
  );

  const handleRestart = useCallback(() => {
    void loadWanderers(bucket);
  }, [bucket, loadWanderers]);

  const handleBrowseSkipped = useCallback((targetUserId: string) => {
    setItems((prev) => {
      const removed = prev.find((item) => item.id === targetUserId);
      if (removed) {
        browseSkippedCardsRef.current.set(targetUserId, removed);
      }

      const next = prev.filter((item) => item.id !== targetUserId);
      const remainingVisible = applyWanderersFilters(
        user?.id ? next.filter((item) => item.id !== user.id) : next,
        filters,
      );

      // Пролистали всех, кто проходит фильтр — круг с начала, без избранных/скрытых.
      if (remainingVisible.length === 0 && browseSkippedCardsRef.current.size > 0) {
        const existing = new Set(next.map((item) => item.id));
        const looped = [...browseSkippedCardsRef.current.values()].filter(
          (item) => !existing.has(item.id),
        );
        browseSkippedCardsRef.current.clear();
        return [...looped, ...next];
      }

      return next;
    });
  }, [filters, user?.id]);

  const handleBrowseRestored = useCallback((targetUserId: string) => {
    const cached = browseSkippedCardsRef.current.get(targetUserId);
    browseSkippedCardsRef.current.delete(targetUserId);
    if (!cached) {
      return;
    }
    setItems((prev) =>
      prev.some((item) => item.id === targetUserId) ? prev : [cached, ...prev],
    );
  }, []);

  const handleReactionSaved = useCallback(
    (targetUserId: string, type: WandererReactionType) => {
      browseSkippedCardsRef.current.delete(targetUserId);

      if (searchActive) {
        setSearchResults((prev) => {
          if (type === 'skipped') {
            return prev.filter((item) => item.id !== targetUserId);
          }
          return prev.map((item) =>
            item.id === targetUserId ? { ...item, isFavorite: true } : item,
          );
        });
        void loadBucketCounts();
        setItems((prev) => {
          if (bucket === 'feed') {
            return prev.filter((item) => item.id !== targetUserId);
          }
          if (bucket === 'favorites' && type === 'skipped') {
            return prev.filter((item) => item.id !== targetUserId);
          }
          if (bucket === 'skipped' && type === 'favorite') {
            return prev.filter((item) => item.id !== targetUserId);
          }
          return prev;
        });
        return;
      }

      if (bucket === 'feed') {
        setItems((prev) => {
          const removed = prev.find((item) => item.id === targetUserId);
          if (removed) {
            feedRemovedCardsRef.current.set(targetUserId, removed);
          }
          return prev.filter((item) => item.id !== targetUserId);
        });
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
    [bucket, loadBucketCounts, searchActive],
  );

  const handleReactionCleared = useCallback(
    (targetUserId: string, previousType: WandererReactionType) => {
      if (searchActive) {
        setSearchResults((prev) =>
          prev.map((item) =>
            item.id === targetUserId ? { ...item, isFavorite: false } : item,
          ),
        );
        void loadBucketCounts();
        return;
      }

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
        const cached = feedRemovedCardsRef.current.get(targetUserId);
        feedRemovedCardsRef.current.delete(targetUserId);
        if (cached) {
          setItems((prev) =>
            prev.some((item) => item.id === targetUserId) ? prev : [cached, ...prev],
          );
          return;
        }
        void loadWanderers('feed');
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== targetUserId));
    },
    [bucket, loadBucketCounts, loadWanderers, searchActive],
  );

  const filtersPanel = isFiltersReady ? (
    <WanderersFiltersPanel
      filters={filters}
      options={filterOptions}
      expanded={filtersExpanded}
      onExpandedChange={setFiltersExpanded}
      onChange={handleFiltersChange}
      onClear={handleFiltersClear}
      nicknameQuery={nicknameQuery}
      onNicknameQueryChange={setNicknameQuery}
      bucket={bucket}
      bucketOptions={bucketOptions}
      onBucketChange={handleBucketChange}
      bucketDisabled={isLoading && !searchActive}
    />
  ) : null;

  // Keep one tree while switching buckets/search — a separate spinner layout remounts the header and jumps.
  const showBucketLoading = isLoading && !searchActive && items.length === 0;
  const showBucketError = Boolean(errorMessage) && items.length === 0 && !searchActive;

  const sourceEmpty = searchActive
    ? !isSearching && searchResults.length === 0
    : visibleItems.length === 0;

  return (
    <ScreenTransition animateOnFocus>
      <WandererDeck
        items={deckItems}
        bucket={bucket}
        searchActive={searchActive}
        contentLoading={
          showBucketLoading || (searchActive && isSearching && searchResults.length === 0)
        }
        contentError={
          searchActive ? searchError : showBucketError ? errorMessage : null
        }
        filtersSignature={filtersSignature}
        feedSourceEmpty={sourceEmpty}
        filtersSlot={filtersPanel}
        onRestart={handleRestart}
        onReactionSaved={handleReactionSaved}
        onReactionCleared={handleReactionCleared}
        onBrowseSkipped={searchActive ? undefined : handleBrowseSkipped}
        onBrowseRestored={searchActive ? undefined : handleBrowseRestored}
        onUnblocked={(targetUserId) => {
          if (searchActive) {
            setSearchResults((prev) =>
              prev.map((item) =>
                item.id === targetUserId ? { ...item, blockedByMe: false } : item,
              ),
            );
            return;
          }
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
