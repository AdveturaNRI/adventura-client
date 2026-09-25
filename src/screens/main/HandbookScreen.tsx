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

import { HandbookBreadcrumbs } from '@/components/handbook/HandbookBreadcrumbs';
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
import { MOCK_HANDBOOK_ENTRIES } from '@/data/handbook/mock-entries';
import { getHandbookSystem, MOCK_HANDBOOK_SYSTEMS } from '@/data/handbook/mock-systems';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  consumeHandbookHubIntent,
  getHandbookLocationSync,
  loadHandbookLocation,
} from '@/utils/handbook-location-storage';

import { useMainScreenStyles } from './main-screen.styles';

const DESKTOP_CONTENT_MAX = 1120;
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
      fontSize: isDesktopWeb ? 32 : FontSize.h1,
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
      minWidth: isDesktopWeb ? 220 : 140,
    },
    restoring: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.section,
    },
  });
}

function countEntries(systemId: string): number {
  return MOCK_HANDBOOK_ENTRIES.filter((entry) => entry.systemId === systemId).length;
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

  const systems = useMemo(() => MOCK_HANDBOOK_SYSTEMS, []);

  useLayoutEffect(() => {
    if (restoreTried.current) return;
    restoreTried.current = true;

    if (consumeHandbookHubIntent()) {
      setReady(true);
      return;
    }

    const sync = getHandbookLocationSync();
    if (sync?.systemId && getHandbookSystem(sync.systemId)) {
      router.replace(`/handbook/${sync.systemId}`);
      return;
    }

    void loadHandbookLocation().then((loc) => {
      if (loc.systemId && getHandbookSystem(loc.systemId)) {
        router.replace(`/handbook/${loc.systemId}`);
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
        <View style={mainStyles.container}>
          {!isDesktopWeb || !showDesktopSidebar ? (
            <MobileScreenHeader title="Справочник" />
          ) : null}
          <View style={styles.restoring}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <View style={mainStyles.container}>
        {!isDesktopWeb || !showDesktopSidebar ? (
          <MobileScreenHeader title="Справочник" />
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={mainStyles.scroll}
          contentContainerStyle={[mainStyles.content, { paddingTop: Spacing.sm }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}>
          <View style={styles.shell}>
            <HandbookBreadcrumbs items={[{ label: 'Справочник' }]} />

            <View style={styles.headerBlock}>
              {isDesktopWeb && showDesktopSidebar ? (
                <Text style={styles.pageTitle}>Справочник</Text>
              ) : null}
              <Text style={styles.pageSubtitle}>
                Крупные плитки по системам. Тап — панель только с материалами этой системы.
              </Text>
            </View>

            <View style={styles.grid}>
              {systems.map((system) => (
                <View key={system.id} style={styles.tileWrap}>
                  <HandbookSystemTile
                    system={system}
                    entryCount={countEntries(system.id)}
                    compact={isDesktopWeb}
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
