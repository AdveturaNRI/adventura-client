import { useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HandbookSystemTile } from '@/components/handbook/HandbookSystemTile';
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
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { getHandbookSystem, MOCK_HANDBOOK_SYSTEMS } from '@/data/handbook/mock-systems';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  consumeHandbookHubIntent,
  getHandbookLocationSync,
  loadHandbookLocation,
  saveHandbookLocation,
} from '@/utils/handbook-location-storage';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
const TILE_GAP = Spacing.md;

function createLocalStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    shell: {
      width: '100%',
      maxWidth: isDesktopWeb ? DESKTOP_CONTENT_MAX : undefined,
      alignSelf: isDesktopWeb ? 'center' : undefined,
      gap: isDesktopWeb ? Spacing.lg : Spacing.md + 4,
      paddingBottom: Spacing.xl,
    },
    headerBlock: {
      gap: isDesktopWeb ? Spacing.xs : Spacing.sm,
      paddingBottom: isDesktopWeb ? 0 : Spacing.xs,
    },
    pageTitle: {
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.5,
      maxWidth: isDesktopWeb ? 560 : undefined,
    },
    grid: {
      flexDirection: isDesktopWeb ? 'row' : 'column',
      flexWrap: isDesktopWeb ? 'wrap' : 'nowrap',
      gap: isDesktopWeb ? TILE_GAP : Spacing.md,
    },
    tileWrap: {
      ...(isDesktopWeb
        ? {
            flexBasis: '31.5%',
            flexGrow: 1,
            maxWidth: '32.5%',
            minWidth: 220,
          }
        : {
            width: '100%',
          }),
    },
    restoring: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.section,
    },
  });
}

export default function HandbookScreen() {
  const router = useRouter();
  const colors = useTheme();
  const isDesktopWeb = useIsDesktopWeb();
  const showDesktopSidebar = useIsDesktopSidebarVisible();
  const mainStyles = useMainScreenStyles();
  const styles = useThemedStyles((theme) => createLocalStyles(theme, isDesktopWeb));
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [ready, setReady] = useState(false);
  const restoreTried = useRef(false);
  const showCompactNav = !isDesktopWeb || !showDesktopSidebar;

  const systems = useMemo(() => MOCK_HANDBOOK_SYSTEMS, []);

  useLayoutEffect(() => {
    if (restoreTried.current) return;
    restoreTried.current = true;

    if (consumeHandbookHubIntent()) {
      void saveHandbookLocation({ systemId: null, category: 'all' });
      setReady(true);
      return;
    }

    // push, не replace — иначе хаб выпадает из стека и свайп «назад» уходит из Библиотеки.
    const sync = getHandbookLocationSync();
    if (sync?.systemId && getHandbookSystem(sync.systemId)) {
      setReady(true);
      router.push(`/handbook/${sync.systemId}`);
      return;
    }

    void loadHandbookLocation().then((loc) => {
      if (loc.systemId && getHandbookSystem(loc.systemId)) {
        setReady(true);
        router.push(`/handbook/${loc.systemId}`);
        return;
      }
      setReady(true);
    });
  }, [router]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setShowScrollTop(shouldShowScrollToTop(event.nativeEvent.contentOffset.y));
  };

  if (!ready) {
    return (
      <ScreenTransition>
        <View style={styles.root}>
          <View style={[mainStyles.content, { flex: 1 }]}>
            {showCompactNav ? <MobileScreenHeader title="Библиотека" /> : null}
            <View style={styles.restoring}>
              <ActivityIndicator color={colors.primary} />
            </View>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={styles.root}>
        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={mainStyles.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}>
          <View style={styles.shell}>
            <View style={styles.headerBlock}>
              {showCompactNav ? (
                <MobileScreenHeader title="Библиотека" />
              ) : (
                <Text style={styles.pageTitle}>Библиотека</Text>
              )}
              <Text style={styles.pageSubtitle}>
                Игровые правила, справочные материалы и механики разных настольных систем в одном
                месте.
              </Text>
            </View>

            <View style={styles.grid}>
              {systems.map((system) => (
                <View key={system.id} style={styles.tileWrap}>
                  <HandbookSystemTile
                    system={system}
                    layout={isDesktopWeb ? 'portrait' : 'banner'}
                    onPress={() => router.push(`/handbook/${system.id}`)}
                  />
                </View>
              ))}
            </View>
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
