import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  navigateNavLeaf,
  navigateNavSection,
} from '@/components/navigation/navigate-nav-section';
import { SidebarPartnerCard } from '@/components/partners/SidebarPartnerCard';
import { Menu, MenuItem } from '@/components/ui/navigation/Menu';
import { PRIMARY_NAV_SECTIONS, type NavLeaf } from '@/components/ui/navigation/nav.sections';
import { Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAnnouncementsOptional } from '@/context/AnnouncementContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useWelcomeLanding } from '@/hooks/use-welcome-landing';
import { openAboutLanding } from '@/services/marketing/welcome';
import { getQuestionnaireCompletion } from '@/utils/questionnaire-completion';
import { formatUnreadBadge } from '@/utils/unread-badge';

type MobileAppMenuContextValue = {
  open: () => void;
  close: () => void;
  toggle: () => void;
  isOpen: boolean;
};

const MobileAppMenuContext = createContext<MobileAppMenuContextValue | null>(null);

const MENU_SPRING = {
  damping: 24,
  stiffness: 260,
  mass: 0.82,
};

const SCROLL_TRACK_INSET = 6;
const SCROLL_THUMB_MIN = 28;


function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    /** Только позиция + тень. Высоту задаём числом с visualViewport — иначе низ уезжает под панель Safari. */
    sheetSlide: {
      position: 'absolute',
      top: 0,
      right: 0,
      shadowColor: colors.shadow,
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 16,
    },
    sheetBody: {
      flex: 1,
      flexDirection: 'column',
      backgroundColor: colors.background,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
      flexShrink: 0,
    },
    sheetTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: Radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    closeButtonPressed: {
      opacity: 0.85,
    },
    navScrollWrap: {
      flex: 1,
      flexBasis: 0,
      minHeight: 0,
    },
    navScroll: {
      flex: 1,
    },
    /** Нативный индикатор на iOS гаснет через секунду — держим свой, чтобы было видно, что есть продолжение. */
    scrollTrack: {
      position: 'absolute',
      top: SCROLL_TRACK_INSET,
      bottom: SCROLL_TRACK_INSET,
      right: 4,
      width: 3,
      borderRadius: Radius.pill,
      backgroundColor: colors.borderLight,
    },
    scrollThumb: {
      width: '100%',
      borderRadius: Radius.pill,
      backgroundColor: colors.textMuted,
      opacity: 0.6,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      gap: Spacing.md,
    },
    sectionBlock: {
      gap: 6,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    menuItemWrap: {
      width: '100%',
    },
    /** Сразу под последним пунктом — в видимой зоне, не у нижнего края 900px-экрана. */
    partnerSlot: {
      marginTop: Spacing.sm,
      flexShrink: 0,
    },
  });
}

function AnimatedMenuRow({
  index,
  progress,
  children,
}: {
  index: number;
  progress: SharedValue<number>;
  children: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const enterStart = Math.min(0.18 + index * 0.05, 0.72);
  const enterEnd = Math.min(enterStart + 0.28, 1);

  const itemStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [enterStart, enterEnd], [0, 1], 'clamp'),
    transform: [
      {
        translateX: interpolate(progress.value, [enterStart, enterEnd], [16, 0], 'clamp'),
      },
    ],
  }));

  return <Animated.View style={[styles.menuItemWrap, itemStyle]}>{children}</Animated.View>;
}

function MobileAppMenuModal({
  visible,
  onClose,
  onNavigateLeaf,
  onNavigateSection,
  onOpenAbout,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigateLeaf: (leaf: NavLeaf) => void;
  onNavigateSection: (sectionId: (typeof PRIMARY_NAV_SECTIONS)[number]['id']) => void;
  /** Absent when no welcome landing is set in the admin. */
  onOpenAbout?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const pathname = usePathname();
  const realtime = useRealtimeOptional();
  const announcements = useAnnouncementsOptional();
  const unreadChats = realtime?.unreadChats ?? 0;
  const unreadNews = announcements?.unreadNewsCount ?? 0;
  const { profile, refreshProfile } = useProfile();
  const profileIncomplete =
    profile != null && !getQuestionnaireCompletion(profile).isComplete;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, 420);
  const [viewportHeight, setViewportHeight] = useState(windowHeight);
  const [renderModal, setRenderModal] = useState(visible);
  const progress = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [scrollContentHeight, setScrollContentHeight] = useState(0);

  const canScroll = scrollViewportHeight > 0 && scrollContentHeight > scrollViewportHeight + 1;
  const trackHeight = Math.max(scrollViewportHeight - SCROLL_TRACK_INSET * 2, 0);
  const thumbHeight = canScroll
    ? Math.max(SCROLL_THUMB_MIN, (trackHeight * scrollViewportHeight) / scrollContentHeight)
    : 0;

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const thumbStyle = useAnimatedStyle(() => {
    const maxScroll = scrollContentHeight - scrollViewportHeight;
    const ratio = maxScroll > 0 ? Math.min(Math.max(scrollY.value / maxScroll, 0), 1) : 0;
    return {
      height: thumbHeight,
      transform: [{ translateY: ratio * Math.max(trackHeight - thumbHeight, 0) }],
    };
  }, [scrollContentHeight, scrollViewportHeight, thumbHeight, trackHeight]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setViewportHeight(windowHeight);
      return;
    }
    const read = () => {
      const next = window.visualViewport?.height ?? window.innerHeight;
      setViewportHeight(next > 0 ? next : windowHeight);
    };
    read();
    window.visualViewport?.addEventListener('resize', read);
    window.visualViewport?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      window.visualViewport?.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [windowHeight]);
  useEffect(() => {
    if (visible) {
      setRenderModal(true);
      progress.value = 0;
      progress.value = withSpring(1, MENU_SPRING);
      void refreshProfile();
      return;
    }

    progress.value = withTiming(
      0,
      {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          scrollY.value = 0;
          runOnJS(setRenderModal)(false);
        }
      },
    );
  }, [progress, refreshProfile, scrollY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.46]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    width: sheetWidth,
    height: viewportHeight,
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [sheetWidth, 0]),
      },
    ],
  }), [sheetWidth, viewportHeight]);

  if (!renderModal) {
    return null;
  }

  let animIndex = 0;
  const bottomPad = Math.max(insets.bottom, Spacing.md);

  return (
    <Modal visible={renderModal} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть меню">
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.sheetSlide, sheetStyle]}>
          <View
            style={[
              styles.sheetBody,
              { height: viewportHeight, paddingTop: insets.top + Spacing.sm },
            ]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Меню</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.navScrollWrap}>
              <Animated.ScrollView
                style={styles.navScroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: bottomPad },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                onLayout={(event) => setScrollViewportHeight(event.nativeEvent.layout.height)}
                onContentSizeChange={(_width, height) => setScrollContentHeight(height)}>
                {PRIMARY_NAV_SECTIONS.map((section) => {
                  // Один пункт в разделе — заголовок дублирует название (Новости/Профиль).
                  const showSectionTitle = section.items.length > 1;

                  return (
                    <View key={section.id} style={styles.sectionBlock}>
                      {showSectionTitle ? (
                        <AnimatedMenuRow index={animIndex++} progress={progress}>
                          <Pressable
                            onPress={() => onNavigateSection(section.id)}
                            accessibilityRole="button">
                            <Text style={styles.sectionTitle}>{section.label}</Text>
                          </Pressable>
                        </AnimatedMenuRow>
                      ) : null}

                      <Menu compact>
                        {section.items.map((leaf) => {
                          const index = animIndex++;
                          return (
                            <AnimatedMenuRow key={leaf.id} index={index} progress={progress}>
                              <MenuItem
                                compact
                                label={leaf.label}
                                subtitle={leaf.subtitle}
                                navbarIcon={leaf.routeKey}
                                badge={
                                  leaf.id === 'chats' && unreadChats > 0
                                    ? formatUnreadBadge(unreadChats)
                                    : leaf.id === 'news' && unreadNews > 0
                                      ? formatUnreadBadge(unreadNews)
                                      : undefined
                                }
                                iconAlert={leaf.id === 'profile' && profileIncomplete}
                                onPress={() => onNavigateLeaf(leaf)}
                              />
                            </AnimatedMenuRow>
                          );
                        })}
                      </Menu>
                    </View>
                  );
                })}
                {onOpenAbout ? (
                  <Menu compact>
                    <AnimatedMenuRow index={animIndex++} progress={progress}>
                      <MenuItem
                        compact
                        label="О проекте"
                        subtitle="Кто мы и что такое Adventura"
                        icon="about"
                        onPress={onOpenAbout}
                      />
                    </AnimatedMenuRow>
                  </Menu>
                ) : null}
                <View style={styles.partnerSlot}>
                  <SidebarPartnerCard />
                </View>
              </Animated.ScrollView>
              {canScroll ? (
                <View pointerEvents="none" style={styles.scrollTrack}>
                  <Animated.View style={[styles.scrollThumb, thumbStyle]} />
                </View>
              ) : null}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function MobileAppMenuProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const welcomeLanding = useWelcomeLanding();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleNavigateLeaf = useCallback(
    (leaf: NavLeaf) => {
      close();
      navigateNavLeaf(router, leaf, pathname, { isAuthenticated });
    },
    [close, isAuthenticated, pathname, router],
  );

  const handleNavigateSection = useCallback(
    (sectionId: (typeof PRIMARY_NAV_SECTIONS)[number]['id']) => {
      close();
      navigateNavSection(router, sectionId, pathname, { isAuthenticated });
    },
    [close, isAuthenticated, pathname, router],
  );

  const handleOpenAbout = useCallback(() => {
    if (!welcomeLanding) return;
    close();
    openAboutLanding(router, welcomeLanding);
  }, [close, router, welcomeLanding]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'g' || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      close();
      navigateNavSection(router, 'tools', pathname, { isAuthenticated });
      // Prefer generators within tools
      const generators = PRIMARY_NAV_SECTIONS.find((s) => s.id === 'tools')?.items.find(
        (item) => item.id === 'generators',
      );
      if (generators) {
        navigateNavLeaf(router, generators, pathname, { isAuthenticated });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, isAuthenticated, pathname, router]);

  const value = useMemo(
    () => ({
      open,
      close,
      toggle,
      isOpen,
    }),
    [close, isOpen, open, toggle],
  );

  return (
    <MobileAppMenuContext.Provider value={value}>
      {children}
      <MobileAppMenuModal
        visible={isOpen}
        onClose={close}
        onNavigateLeaf={handleNavigateLeaf}
        onNavigateSection={handleNavigateSection}
        onOpenAbout={welcomeLanding ? handleOpenAbout : undefined}
      />
    </MobileAppMenuContext.Provider>
  );
}

export function useMobileAppMenu() {
  const context = useContext(MobileAppMenuContext);
  if (!context) {
    throw new Error('useMobileAppMenu must be used within MobileAppMenuProvider');
  }

  return context;
}
