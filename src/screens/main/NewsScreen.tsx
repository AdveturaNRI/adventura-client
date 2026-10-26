import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useIsDesktopSidebarVisible,
  useIsDesktopWeb,
} from '@/components/navigation/DesktopThemeToggle';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import {
  ScrollToTopButton,
  shouldShowScrollToTop,
} from '@/components/navigation/ScrollToTopButton';
import { NewsCard } from '@/components/news/NewsCard';
import { PartnerNewsCard } from '@/components/partners/PartnerNewsCard';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useNews } from '@/context/NewsContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  getPartnerNewsFeedCache,
  listPartnerNewsFeed,
  type PartnerNews,
} from '@/services/partners/partnersApi';
import { claimAnnouncementView } from '@/utils/announcement-view-session';
import { useSeenPartnerNews } from '@/utils/partner-news-seen-storage';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 760;

type NewsTab = 'platform' | 'partners';

const TABS: { id: NewsTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'platform', label: 'Adventura', icon: 'newspaper-outline' },
  { id: 'partners', label: 'Партнёры', icon: 'megaphone-outline' },
];

type PartnerFeedState = {
  items: PartnerNews[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
};

/** Грузится и на вкладке «Adventura»: счётчик новых у «Партнёров» нужен сразу. */
function usePartnerNewsFeed(active: boolean) {
  const [state, setState] = useState<PartnerFeedState>(() => ({
    items: getPartnerNewsFeedCache() ?? [],
    isLoading: false,
    isRefreshing: false,
    error: null,
  }));

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    setState((prev) => ({
      ...prev,
      isLoading: mode === 'initial' && prev.items.length === 0,
      isRefreshing: mode === 'refresh',
      error: null,
    }));
    try {
      const items = await listPartnerNewsFeed();
      setState({ items, isLoading: false, isRefreshing: false, error: null });
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: 'Не получилось загрузить новости партнёров',
      }));
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [active, load]);
  return { ...state, refresh: () => load('refresh') };
}

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: Spacing.md,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: Spacing.xs,
    },
    tabsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    tabSelected: {
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    tabLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
    },
    tabLabelSelected: {
      color: colors.primary,
    },
    tabCount: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 14,
      color: colors.onPrimary,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    list: {
      gap: Spacing.md,
    },
    empty: {
      paddingVertical: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emptyText: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      textAlign: 'center',
    },
    retry: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    retryText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export default function NewsScreen() {
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab: NewsTab = params.tab === 'partners' ? 'partners' : 'platform';
  const news = useNews();
  const partnerFeed = usePartnerNewsFeed(tab === 'partners');
  const seenPartnerNews = useSeenPartnerNews();
  const { toggleLike, incrementViews } = news;
  const { items, isLoading, isRefreshing, error, refresh } =
    tab === 'partners' ? partnerFeed : news;
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const newCount: Record<NewsTab, number> = {
    platform: news.items.filter((item) => item.unread).length,
    partners: partnerFeed.items.filter((item) => !seenPartnerNews.has(item.id)).length,
  };

  const selectTab = (next: NewsTab) => {
    if (next === tab) return;
    router.setParams({ tab: next === 'partners' ? 'partners' : undefined });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
  }, []);

  return (
    <ScreenTransition animateOnFocus>
      <View style={mainStyles.container}>
        {!hasDesktopSidebar ? (
          <MobileScreenHeader title="Новости" />
        ) : null}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[mainStyles.content, styles.shell]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void refresh();
              }}
              tintColor={colors.primary}
            />
          }>
          {hasDesktopSidebar ? (
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>Новости</Text>
            </View>
          ) : null}

          <View style={styles.tabsRow} accessibilityRole="tablist">
            {TABS.map((item) => {
              const selected = item.id === tab;
              const count = newCount[item.id];
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityLabel={count > 0 ? `${item.label}, новых: ${count}` : item.label}
                  accessibilityState={{ selected }}
                  onPress={() => selectTab(item.id)}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.tabSelected,
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={selected ? colors.primary : colors.text}
                  />
                  <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                    {item.label}
                  </Text>
                  {count > 0 ? (
                    <View style={styles.tabCount}>
                      <Text style={styles.tabCountText}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {isLoading && items.length === 0 ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.emptyText}>Загружаем новости…</Text>
            </View>
          ) : null}

          {!isLoading && error && items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable
                onPress={() => {
                  void refresh();
                }}
                style={styles.retry}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !error && items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {tab === 'partners'
                  ? 'Партнёры пока ничего не публиковали'
                  : 'Пока нет опубликованных новостей'}
              </Text>
            </View>
          ) : null}

          {tab === 'partners' && partnerFeed.items.length > 0 ? (
            <View style={styles.list}>
              {partnerFeed.items.map((item) => (
                <PartnerNewsCard
                  key={item.id}
                  item={item}
                  unread={!seenPartnerNews.has(item.id)}
                />
              ))}
            </View>
          ) : null}

          {tab === 'platform' && news.items.length > 0 ? (
            <View style={styles.list}>
              {news.items.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onToggleLike={(id) => {
                    void toggleLike(id);
                  }}
                  onOpen={(id) => {
                    if (!claimAnnouncementView(id)) return;
                    void incrementViews(id);
                  }}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <ScrollToTopButton
          visible={showScrollTop}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        />
      </View>
    </ScreenTransition>
  );
}
