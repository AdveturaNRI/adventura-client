import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { copyTextToClipboard } from '@/components/gm-toolkit/copyText';
import { NameWithBadges } from '@/components/rewards/RewardBadge';
import { ProfileAvatarEditor } from '@/components/profile/ProfileAvatarEditor';
import { toast } from '@/components/ui';
import type { AvatarFrameId, RewardBadgeType } from '@/data/rewards/catalog';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
    nickSearchRow: {
      marginTop: 4,
      alignSelf: isDesktopWeb ? 'flex-start' : 'center',
    },
    nickSearchChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      minHeight: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    nickSearchChipPressed: {
      opacity: 0.88,
    },
    nickSearchLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.2,
    },
    nickSearchValue: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      maxWidth: 160,
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
  const colors = useTheme();
  const styles = useThemedStyles((theme) => createStyles(theme, isDesktopWeb));

  const copyNickname = async () => {
    try {
      await copyTextToClipboard(nickname);
      toast.success('Ник скопировали — так тебя найдут в поиске');
    } catch {
      toast.error('Не удалось скопировать ник');
    }
  };

  const nickSearchChip = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Скопировать ник для поиска: ${nickname}`}
      onPress={() => void copyNickname()}
      style={({ pressed }) => [
        styles.nickSearchChip,
        pressed && styles.nickSearchChipPressed,
      ]}>
      <Ionicons name="copy-outline" size={13} color={colors.primary} />
      <Text style={styles.nickSearchLabel}>Ник для поиска</Text>
      <Text style={styles.nickSearchValue} numberOfLines={1}>
        {nickname}
      </Text>
    </Pressable>
  );

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
          <View style={styles.nickSearchRow}>{nickSearchChip}</View>
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
      <View style={styles.nickSearchRow}>{nickSearchChip}</View>
    </View>
  );
}
