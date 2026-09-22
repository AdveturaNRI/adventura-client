import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { ProfileAvatarEditor } from '@/components/profile/ProfileAvatarEditor';
import type { AvatarFrameId, RewardBadgeType } from '@/data/rewards/catalog';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type ProfileHeaderCardProps = {
  nickname: string;
  avatarUrl: string | null;
  accountLabel: string;
  isDesktopWeb: boolean;
  logoutButton?: ReactNode;
  badges?: RewardBadgeType[];
  frameId?: AvatarFrameId | string | null;
};

function formatNicknameForDisplay(nickname: string): string {
  return nickname.replace(/_/g, '_\u200B');
}

function createStyles(colors: ThemeColors, isDesktopWeb: boolean) {
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
      padding: Spacing.lg,
      gap: Spacing.sm,
      ...(isDesktopWeb
        ? {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: Spacing.md,
          }
        : {
            alignItems: 'center',
          }),
    },
    desktopMain: {
      flex: 1,
      minWidth: 0,
      gap: Spacing.sm,
      paddingTop: 2,
    },
    name: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
      lineHeight: FontSize.button * 1.3,
      ...(isDesktopWeb ? {} : { textAlign: 'center' }),
    },
    accountLabel: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.35,
      ...(isDesktopWeb ? {} : { textAlign: 'center' }),
    },
    desktopLogout: {
      flexShrink: 0,
    },
  });
}

export function ProfileHeaderCard({
  nickname,
  avatarUrl,
  accountLabel,
  isDesktopWeb,
  logoutButton,
  badges,
  frameId,
}: ProfileHeaderCardProps) {
  const styles = useThemedStyles((colors) => createStyles(colors, isDesktopWeb));

  if (isDesktopWeb) {
    return (
      <View style={styles.card}>
        <ProfileAvatarEditor nickname={nickname} avatarUrl={avatarUrl} size={96} badges={badges} frameId={frameId} />
        <View style={styles.desktopMain}>
          <NameWithBadges
            name={formatNicknameForDisplay(nickname)}
            badges={badges}
            textStyle={styles.name}
            badgeSize={14}
          />
          <Text style={styles.accountLabel}>{accountLabel}</Text>
        </View>
        {logoutButton ? <View style={styles.desktopLogout}>{logoutButton}</View> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <ProfileAvatarEditor nickname={nickname} avatarUrl={avatarUrl} size={80} badges={badges} frameId={frameId} />
      <NameWithBadges
        name={formatNicknameForDisplay(nickname)}
        badges={badges}
        textStyle={styles.name}
        badgeSize={14}
      />
      <Text style={styles.accountLabel}>{accountLabel}</Text>
    </View>
  );
}
