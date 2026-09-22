import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthorContacts } from '@/components/authors/AuthorContacts';
import { CreativityCategoryBadges } from '@/components/authors/CreativityCategoryBadge';
import { UserAvatar } from '@/components/navigation/UserAvatar';
import type { Author } from '@/data/authors/types';
import type { RewardBadgeType } from '@/data/rewards/catalog';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

type AuthorProfileProps = {
  author: Author;
  actions?: ReactNode;
  /** `panel` — вертикальный сайдбар для десктоп-кабинета */
  variant?: 'default' | 'panel';
};

function createStyles(colors: ThemeColors, variant: 'default' | 'panel') {
  const isPanel = variant === 'panel';

  return StyleSheet.create({
    root: {
      gap: Spacing.md,
      padding: isPanel ? Spacing.lg : Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surface,
    },
    topRow: {
      flexDirection: isPanel ? 'column' : 'row',
      alignItems: isPanel ? 'flex-start' : 'center',
      gap: isPanel ? Spacing.md : Spacing.md,
    },
    body: {
      flex: isPanel ? undefined : 1,
      minWidth: 0,
      gap: 8,
      width: isPanel ? '100%' : undefined,
    },
    name: {
      fontSize: isPanel ? 26 : FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    description: {
      fontSize: FontSize.label,
      color: colors.textMuted,
      lineHeight: FontSize.label * 1.45,
    },
    actions: {
      gap: Spacing.sm,
    },
  });
}

export function AuthorProfile({
  author,
  actions,
  variant = 'default',
}: AuthorProfileProps) {
  const styles = useThemedStyles((theme) => createStyles(theme, variant));
  const avatarSize = variant === 'panel' ? 88 : 72;

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <UserAvatar
          nickname={author.name}
          avatarUrl={author.avatar || null}
          size={avatarSize}
          badges={(author.badges as RewardBadgeType[] | undefined) ?? null}
          frameId={author.avatarFrameId}
        />
        <View style={styles.body}>
          <Text style={styles.name}>{author.name}</Text>
          <CreativityCategoryBadges categories={author.categories} />
        </View>
      </View>

      {author.description ? <Text style={styles.description}>{author.description}</Text> : null}

      {actions ? <View style={styles.actions}>{actions}</View> : null}

      <AuthorContacts contacts={author.contacts} />
    </View>
  );
}
