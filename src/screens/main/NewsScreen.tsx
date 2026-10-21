import { useCallback, useRef, useState } from 'react';
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
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useNews } from '@/context/NewsContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { claimAnnouncementView } from '@/utils/announcement-view-session';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 760;

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
  const { items, isLoading, isRefreshing, error, refresh, toggleLike, incrementViews } =
    useNews();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

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
              <Text style={styles.emptyText}>Пока нет опубликованных новостей</Text>
            </View>
          ) : null}

          {items.length > 0 ? (
            <View style={styles.list}>
              {items.map((item) => (
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
