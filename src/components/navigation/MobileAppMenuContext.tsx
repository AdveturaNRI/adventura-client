import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigateMainTab, navigateMainTabFromNav } from '@/components/navigation/navigate-main-tab';
import { Menu, MenuItem } from '@/components/ui/navigation/Menu';
import {
  MOBILE_APP_MENU_ITEMS,
  type MobileAppMenuItem,
} from '@/components/ui/navigation/navbar.config';
import { Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    sheet: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      overflow: 'hidden',
      shadowColor: colors.shadow,
      shadowOffset: { width: -8, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
      elevation: 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
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
      backgroundColor: colors.surfaceMuted,
    },
    closeButtonPressed: {
      opacity: 0.85,
    },
    scrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xl,
    },
    menuItemWrap: {
      width: '100%',
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
  // Stagger must finish at progress=1 — otherwise last rows stay semi-transparent (look “disabled”).
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

  return (
    <Animated.View style={[styles.menuItemWrap, itemStyle]}>
      {children}
    </Animated.View>
  );
}

function MobileAppMenuModal({
  visible,
  onClose,
  onNavigate,
}: {
  visible: boolean;
  onClose: () => void;
  onNavigate: (item: MobileAppMenuItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const realtime = useRealtimeOptional();
  const unreadChats = realtime?.unreadChats ?? 0;
  const { profile, refreshProfile } = useProfile();
  const profileIncomplete = !getQuestionnaireCompletion(profile).isComplete;
  const { width: windowWidth } = useWindowDimensions();
  const sheetWidth = Math.min(windowWidth, 420);
  const [renderModal, setRenderModal] = useState(visible);
  const progress = useSharedValue(0);

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
          runOnJS(setRenderModal)(false);
        }
      },
    );
  }, [progress, refreshProfile, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.46]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    width: sheetWidth,
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [sheetWidth, 0]),
      },
    ],
  }));

  if (!renderModal) {
    return null;
  }

  return (
    <Modal visible={renderModal} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть меню">
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        <Animated.View style={[styles.sheet, { paddingTop: insets.top + Spacing.sm }, sheetStyle]}>
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

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Menu>
              {MOBILE_APP_MENU_ITEMS.map((item, index) => (
                <AnimatedMenuRow key={item.key} index={index} progress={progress}>
                  <MenuItem
                    label={item.label}
                    subtitle={item.subtitle}
                    navbarIcon={item.icon}
                    badge={
                      item.key === 'chats' && unreadChats > 0
                        ? formatUnreadBadge(unreadChats)
                        : undefined
                    }
                    iconAlert={item.key === 'profile' && profileIncomplete}
                    onPress={() => onNavigate(item)}
                  />
                </AnimatedMenuRow>
              ))}
            </Menu>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function MobileAppMenuProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleNavigate = useCallback(
    (item: MobileAppMenuItem) => {
      close();
      navigateMainTabFromNav(router, item.key, pathname, { isAuthenticated });
    },
    [close, isAuthenticated, pathname, router],
  );

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
      navigateMainTab(router, 'generators', { isAuthenticated });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, isAuthenticated, router]);

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
      <MobileAppMenuModal visible={isOpen} onClose={close} onNavigate={handleNavigate} />
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
