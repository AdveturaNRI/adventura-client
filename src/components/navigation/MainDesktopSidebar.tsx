import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/navigation/AppLogo';
import { navigateNavLeaf } from '@/components/navigation/navigate-nav-section';
import { NavSectionIcon } from '@/components/navigation/NavSectionIcon';
import { SidebarPartnerCard } from '@/components/partners/SidebarPartnerCard';
import { MAIN_APP_ENTRY } from '@/components/ui/navigation/navbar.config';
import { NavbarIcon } from '@/components/ui/navigation/NavbarIcon';
import {
  matchNavLeafId,
  matchNavSectionId,
  PRIMARY_NAV_SECTIONS,
  type NavLeaf,
  type NavSection,
  type NavSectionId,
} from '@/components/ui/navigation/nav.sections';
import { Spacing, type ThemeColors } from '@/constants/theme';
import { useAnnouncementsOptional } from '@/context/AnnouncementContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/context/ProfileContext';
import { useRealtimeOptional } from '@/context/RealtimeContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getQuestionnaireCompletion } from '@/utils/questionnaire-completion';
import { formatUnreadBadge } from '@/utils/unread-badge';

export const DESKTOP_SIDEBAR_WIDTH = 248;

const ICON_SIZE = 18;
const SUB_ICON_SIZE = 16;
const CHEVRON_MS = 180;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function sectionHasChildren(section: NavSection) {
  return section.items.length > 1;
}

/** Ниже этой высоты экрана партнёрскую карточку прячем, чтобы меню оставалось доступным. */
const PARTNER_MIN_VIEWPORT_HEIGHT = 640;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      width: DESKTOP_SIDEBAR_WIDTH,
      flexShrink: 0,
      alignSelf: 'stretch',
      height: '100%',
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.surface,
    },
    inner: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'column',
      paddingHorizontal: 12,
      paddingBottom: Spacing.md,
    },
    logoWrap: {
      paddingHorizontal: 4,
      paddingTop: 2,
      paddingBottom: 16,
      flexShrink: 0,
    },
    navScroll: {
      flex: 1,
      minHeight: 0,
    },
    nav: {
      gap: 2,
      paddingBottom: 8,
    },
    sectionBlock: {
      gap: 0,
      marginBottom: 6,
    },
    groupRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 40,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
    },
    groupRowContained: {
      // Parent of active leaf — quiet hint, not a second primary button
      backgroundColor: 'transparent',
    },
    groupRowPressed: {
      opacity: 0.82,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 40,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
    },
    linkRowActive: {
      backgroundColor: 'rgba(21, 122, 254, 0.09)',
    },
    iconWrap: {
      position: 'relative',
      width: ICON_SIZE,
      height: ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconAlert: {
      position: 'absolute',
      top: -5,
      right: -6,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    iconAlertText: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 11,
    },
    groupLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 20,
      color: colors.text,
    },
    groupLabelContained: {
      color: colors.text,
      fontWeight: '500',
    },
    linkLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 20,
      color: colors.text,
    },
    linkLabelActive: {
      color: colors.primary,
      fontWeight: '500',
    },
    chevron: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    subnav: {
      paddingLeft: 8,
      paddingRight: 4,
      paddingBottom: 2,
      gap: 0,
    },
    subItem: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 32,
      paddingVertical: 5,
      paddingLeft: 12,
      paddingRight: 10,
      borderRadius: 6,
    },
    subItemActive: {
      backgroundColor: 'rgba(21, 122, 254, 0.08)',
    },
    subIconWrap: {
      width: SUB_ICON_SIZE,
      height: SUB_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    subLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      color: colors.textSecondary,
    },
    subLabelActive: {
      color: colors.primary,
      fontWeight: '500',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.borderLight,
      marginVertical: 6,
      marginHorizontal: 8,
    },
    footerGap: {
      height: 12,
      flexShrink: 0,
    },
    footer: {
      flexShrink: 0,
    },
  });
}

function Chevron({ expanded, reduceMotion }: { expanded: boolean; reduceMotion: boolean }) {
  const colors = useTheme();
  const rotation = useSharedValue(expanded ? 90 : 0);

  useEffect(() => {
    rotation.value = reduceMotion
      ? expanded
        ? 90
        : 0
      : withTiming(expanded ? 90 : 0, { duration: CHEVRON_MS });
  }, [expanded, reduceMotion, rotation]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[style, { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Animated.View>
  );
}

export function MainDesktopSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const realtime = useRealtimeOptional();
  const announcements = useAnnouncementsOptional();
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const unreadChats = realtime?.unreadChats ?? 0;
  const unreadNews = announcements?.unreadNewsCount ?? 0;
  const profileIncomplete =
    profile != null && !getQuestionnaireCompletion(profile).isComplete;
  const showPartnerCard = viewportHeight >= PARTNER_MIN_VIEWPORT_HEIGHT;

  const activeSectionId = matchNavSectionId(pathname);
  const activeLeafId = matchNavLeafId(pathname);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<NavSectionId>>(() => {
    const initial = new Set<NavSectionId>();
    for (const section of PRIMARY_NAV_SECTIONS) {
      if (sectionHasChildren(section)) {
        initial.add(section.id);
      }
    }
    return initial;
  });

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      // RN web / native listener shape differs slightly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sub as any)?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!activeSectionId) return;
    const section = PRIMARY_NAV_SECTIONS.find((item) => item.id === activeSectionId);
    if (!section || !sectionHasChildren(section)) return;
    setExpandedIds((prev) => {
      if (prev.has(activeSectionId)) return prev;
      const next = new Set(prev);
      next.add(activeSectionId);
      return next;
    });
  }, [activeSectionId]);

  const animateLayout = useCallback(() => {
    if (reduceMotion) return;
    LayoutAnimation.configureNext({
      duration: CHEVRON_MS,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
      delete: {
        type: LayoutAnimation.Types.easeInEaseOut,
        property: LayoutAnimation.Properties.opacity,
      },
    });
  }, [reduceMotion]);

  const toggleGroup = useCallback(
    (sectionId: NavSectionId) => {
      animateLayout();
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        return next;
      });
    },
    [animateLayout],
  );

  const grouped = useMemo(
    () => PRIMARY_NAV_SECTIONS.filter((section) => sectionHasChildren(section)),
    [],
  );
  const standalone = useMemo(
    () => PRIMARY_NAV_SECTIONS.filter((section) => !sectionHasChildren(section)),
    [],
  );

  const renderLeaf = (leaf: NavLeaf) => {
    const leafActive = leaf.id === activeLeafId;
    const leafChatBadge = leaf.id === 'chats' && unreadChats > 0;

    return (
      <Pressable
        key={leaf.id}
        accessibilityRole="link"
        accessibilityState={{ selected: leafActive }}
        accessibilityLabel={
          leafChatBadge ? `${leaf.label}, непрочитанных: ${unreadChats}` : leaf.label
        }
        onPress={() => {
          navigateNavLeaf(router, leaf, pathname, { isAuthenticated });
        }}
        style={({ pressed }) => [
          styles.subItem,
          leafActive && styles.subItemActive,
          pressed && { opacity: 0.88 },
        ]}>
        <View style={styles.subIconWrap}>
          <NavbarIcon
            name={leaf.routeKey}
            size={SUB_ICON_SIZE}
            active={leafActive}
            color={leafActive ? colors.primary : colors.textMuted}
          />
        </View>
        <Text style={[styles.subLabel, leafActive && styles.subLabelActive]} numberOfLines={1}>
          {leaf.label}
        </Text>
        {leafChatBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatUnreadBadge(unreadChats)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderGroup = (section: NavSection) => {
    const containsActive = section.id === activeSectionId;
    const expanded = expandedIds.has(section.id);
    const panelId = `sidebar-subnav-${section.id}`;
    const showChatBadge = section.id === 'community' && unreadChats > 0;

    return (
      <View key={section.id} style={styles.sectionBlock}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={section.label}
          accessibilityHint={expanded ? 'Свернуть раздел' : 'Развернуть раздел'}
          nativeID={`sidebar-group-${section.id}`}
          onPress={() => toggleGroup(section.id)}
          style={({ pressed }) => [
            styles.groupRow,
            containsActive && styles.groupRowContained,
            pressed && styles.groupRowPressed,
          ]}>
          <View style={styles.iconWrap}>
            <NavSectionIcon
              name={section.icon}
              size={ICON_SIZE}
              color={containsActive ? colors.text : colors.textMuted}
            />
          </View>
          <Text
            style={[styles.groupLabel, containsActive && styles.groupLabelContained]}
            numberOfLines={1}>
            {section.label}
          </Text>
          {showChatBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{formatUnreadBadge(unreadChats)}</Text>
            </View>
          ) : null}
          <View style={styles.chevron}>
            <Chevron expanded={expanded} reduceMotion={reduceMotion} />
          </View>
        </Pressable>

        {expanded ? (
          <View style={styles.subnav} nativeID={panelId} accessibilityRole="menu">
            {section.items.map((leaf) => renderLeaf(leaf))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderStandalone = (section: NavSection) => {
    const leaf = section.items[0];
    if (!leaf) return null;
    const isActive = leaf.id === activeLeafId;
    const showProfileAlert = section.id === 'profile' && profileIncomplete;
    const showNewsBadge = section.id === 'news' && unreadNews > 0;

    return (
      <Pressable
        key={section.id}
        accessibilityRole="link"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={
          showProfileAlert
            ? `${section.label}, анкета не заполнена`
            : showNewsBadge
              ? `${section.label}, непрочитанных: ${unreadNews}`
              : section.label
        }
        onPress={() => {
          navigateNavLeaf(router, leaf, pathname, { isAuthenticated });
        }}
        style={({ pressed }) => [
          styles.linkRow,
          isActive && styles.linkRowActive,
          pressed && { opacity: 0.88 },
        ]}>
        <View style={styles.iconWrap}>
          {section.id === 'profile' ? (
            <NavbarIcon name="profile" size={ICON_SIZE} active={isActive} />
          ) : (
            <NavSectionIcon
              name={section.icon}
              size={ICON_SIZE}
              color={isActive ? colors.primary : colors.textMuted}
            />
          )}
          {showProfileAlert ? (
            <View style={styles.iconAlert} accessibilityLabel="Требует внимания">
              <Text style={styles.iconAlertText}>!</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.linkLabel, isActive && styles.linkLabelActive]} numberOfLines={1}>
          {section.label}
        </Text>
        {showNewsBadge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatUnreadBadge(unreadNews)}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inner, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.logoWrap}>
          <AppLogo href={MAIN_APP_ENTRY} height={34} align="left" />
        </View>

        <ScrollView
          style={styles.navScroll}
          contentContainerStyle={styles.nav}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {standalone.map(renderStandalone)}
          <View style={styles.divider} />
          {grouped.map(renderGroup)}
        </ScrollView>

        {showPartnerCard ? (
          <>
            <View style={styles.footerGap} />
            <View style={styles.footer}>
              <SidebarPartnerCard />
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
