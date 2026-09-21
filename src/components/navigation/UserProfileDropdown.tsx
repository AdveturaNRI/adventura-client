import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { UserAvatar } from '@/components/navigation/UserAvatar';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useMyAvatarUrl, useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingLeft: Spacing.sm,
      paddingRight: Spacing.sm,
      paddingVertical: Spacing.xs,
      borderRadius: 999,
    },
    triggerPressed: {
      opacity: 0.85,
      backgroundColor: colors.surfaceMuted,
    },
    nickname: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: colors.text,
      maxWidth: 160,
    },
    chevron: {
      marginLeft: -Spacing.xs,
    },
    modalRoot: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    menu: {
      position: 'absolute',
      minWidth: 180,
      paddingVertical: Spacing.xs,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
      elevation: 8,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
    },
    menuItemPressed: {
      backgroundColor: colors.surfaceMuted,
    },
    menuItemLabel: {
      fontSize: FontSize.label,
      fontWeight: '500',
      color: colors.text,
    },
    menuItemLabelDanger: {
      color: colors.destructive,
    },
  });
}

export function UserProfileDropdown() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const avatarUrl = useMyAvatarUrl();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width: windowWidth } = useWindowDimensions();
  const triggerRef = useRef<View>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  if (!user) {
    return null;
  }

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleOpenProfile = () => {
    closeMenu();
    router.navigate('/profile');
  };

  const handleSignOut = async () => {
    closeMenu();
    await signOut();
    router.replace('/auth/login');
  };

  const menuStyle =
    anchor == null
      ? null
      : {
          top: anchor.y + anchor.height + Spacing.sm,
          left: Math.max(Spacing.md, anchor.x + anchor.width - 180),
          maxWidth: windowWidth - Spacing.md * 2,
        };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Меню профиля: ${user.nickname}`}
          accessibilityState={{ expanded: isOpen }}
          onPress={isOpen ? closeMenu : openMenu}
          style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}>
          <UserAvatar
            nickname={user.nickname}
            avatarUrl={avatarUrl}
            size={36}
            badges={profile?.perks?.visibleBadges ?? profile?.perks?.badges}
            frameId={profile?.perks ? profile.perks.avatarFrameId : undefined}
          />
          <Text style={styles.nickname} numberOfLines={1}>
            {user.nickname}
          </Text>
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
            style={styles.chevron}
          />
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityLabel="Закрыть меню" />
          {menuStyle ? (
            <View style={[styles.menu, menuStyle]}>
              <Pressable
                accessibilityRole="button"
                onPress={handleOpenProfile}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                <Ionicons name="person-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemLabel}>Профиль</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSignOut}
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
                <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
                <Text style={[styles.menuItemLabel, styles.menuItemLabelDanger]}>Выйти</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
