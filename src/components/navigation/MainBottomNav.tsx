import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMobileAppMenu } from '@/components/navigation/MobileAppMenuContext';
import { navigateNavSection } from '@/components/navigation/navigate-nav-section';
import { NavSectionIcon } from '@/components/navigation/NavSectionIcon';
import { NavbarIcon } from '@/components/ui/navigation/NavbarIcon';
import {
  matchNavSectionId,
  PRIMARY_NAV_SECTIONS,
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

/** Bottom slots: first four sections + «Ещё» (profile + full menu). */
const BOTTOM_SECTION_IDS = ['play', 'community', 'tools', 'news'] as const;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingTop: Spacing.xs,
      paddingHorizontal: 2,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      paddingVertical: Spacing.xs,
      minWidth: 0,
    },
    itemPressed: {
      opacity: 0.75,
    },
    iconWrap: {
      position: 'relative',
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.destructive,
    },
    badgeText: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '800',
      lineHeight: 12,
    },
    label: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textMuted,
      textAlign: 'center',
    },
    labelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
  });
}

export function MainBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isAuthenticated } = useAuth();
  const { open } = useMobileAppMenu();
  const realtime = useRealtimeOptional();
  const announcements = useAnnouncementsOptional();
  const { profile } = useProfile();
  const unreadChats = realtime?.unreadChats ?? 0;
  const unreadNews = announcements?.unreadNewsCount ?? 0;
  const profileIncomplete =
    profile != null && !getQuestionnaireCompletion(profile).isComplete;
  const activeSectionId = matchNavSectionId(pathname);
  const profileActive = activeSectionId === 'profile';

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
      ]}>
      {BOTTOM_SECTION_IDS.map((sectionId) => {
        const section = PRIMARY_NAV_SECTIONS.find((item) => item.id === sectionId);
        if (!section) return null;
        const isActive = section.id === activeSectionId;
        const showChatBadge = section.id === 'community' && unreadChats > 0;
        const showNewsBadge = section.id === 'news' && unreadNews > 0;
        const badgeCount = showChatBadge ? unreadChats : showNewsBadge ? unreadNews : 0;

        return (
          <Pressable
            key={section.id}
            onPress={() => {
              navigateNavSection(router, section, pathname, { isAuthenticated });
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={
              badgeCount > 0
                ? `${section.label}, непрочитанных: ${badgeCount}`
                : section.label
            }>
            <View style={styles.iconWrap}>
              <NavSectionIcon
                name={section.icon}
                size={22}
                color={isActive ? colors.primary : colors.textMuted}
              />
              {badgeCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{formatUnreadBadge(badgeCount)}</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}>
              {section.shortLabel}
            </Text>
          </Pressable>
        );
      })}

      <Pressable
        onPress={open}
        style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        accessibilityRole="button"
        accessibilityState={{ selected: profileActive }}
        accessibilityLabel="Ещё">
        <View style={styles.iconWrap}>
          <NavbarIcon name="profile" size={22} active={profileActive} />
          {profileIncomplete ? (
            <View style={styles.badge} accessibilityLabel="Требует внимания">
              <Text style={styles.badgeText}>!</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.label, profileActive && styles.labelActive]}
          numberOfLines={1}>
          Ещё
        </Text>
      </Pressable>
    </View>
  );
}
