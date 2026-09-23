import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import type { AuthorPost } from '@/data/authors/types';
import { FontSize, Radius, Spacing, type ThemeColors } from '@/constants/theme';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { formatAuthorPrice } from '@/utils/authors-format';

type AuthorPostPurchaseProps = {
  post: Pick<
    AuthorPost,
    'isForSale' | 'price' | 'currency' | 'purchaseDescription' | 'purchaseUrl'
  >;
  /** Компактный чип для пина в ленте */
  compact?: boolean;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      gap: Spacing.sm,
      padding: Spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(52, 199, 89, 0.4)',
      backgroundColor: 'rgba(52, 199, 89, 0.14)',
    },
    badgeLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.success,
    },
    price: {
      fontSize: FontSize.h1,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    description: {
      fontSize: FontSize.caption,
      color: colors.textSecondary,
      lineHeight: FontSize.caption * 1.45,
    },
    hint: {
      fontSize: FontSize.caption,
      color: colors.textMuted,
      lineHeight: FontSize.caption * 1.4,
    },
    chip: {
      alignSelf: 'stretch',
      minHeight: 32,
      paddingHorizontal: 10,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    chipLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    chipPrice: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    chipAction: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}

export function AuthorPostPurchase({ post, compact = false }: AuthorPostPurchaseProps) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const requireAuth = useRequireAuth();

  if (!post.isForSale || post.price == null) {
    return null;
  }

  const priceLabel = formatAuthorPrice(post.price, post.currency);
  const canBuy = Boolean(post.purchaseUrl?.trim());

  const openPurchase = () => {
    if (!requireAuth()) {
      return;
    }
    if (post.purchaseUrl) {
      void Linking.openURL(post.purchaseUrl);
    }
  };

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Приобрести за ${priceLabel}`}
        disabled={!canBuy}
        onPress={openPurchase}
        style={({ pressed }) => [styles.chip, pressed && canBuy && { opacity: 0.88 }, !canBuy && { opacity: 0.5 }]}>
        <View style={styles.chipLeft}>
          <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
          <Text style={styles.chipPrice} numberOfLines={1}>
            {priceLabel}
          </Text>
        </View>
        <Text style={styles.chipAction}>Приобрести</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.price}>{priceLabel}</Text>
        <View style={styles.badge}>
          <Ionicons name="pricetag" size={12} color={colors.success} />
          <Text style={styles.badgeLabel}>Можно купить</Text>
        </View>
      </View>
      {post.purchaseDescription ? (
        <Text style={styles.description}>{post.purchaseDescription}</Text>
      ) : null}
      <Text style={styles.hint}>Оплата напрямую автору — без корзины в Adventura.</Text>
      <Button label="Приобрести" variant="primary" disabled={!canBuy} onPress={openPurchase} />
    </View>
  );
}

/** Бейдж цены поверх обложки пина */
export function AuthorPostPriceBadge({
  price,
  currency,
  compact = false,
}: {
  price: number;
  currency?: string;
  compact?: boolean;
}) {
  const colors = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: compact ? 6 : 10,
        right: compact ? 6 : 10,
        minHeight: compact ? 22 : 28,
        paddingHorizontal: compact ? 7 : 10,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: 'rgba(52, 199, 89, 0.45)',
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      }}>
      <Text style={{ fontSize: compact ? 11 : 12, fontWeight: '700', color: colors.success }}>
        {formatAuthorPrice(price, currency)}
      </Text>
    </View>
  );
}
