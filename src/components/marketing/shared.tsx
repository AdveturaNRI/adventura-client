import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  MarketingLayout,
  MarketingType,
  type ResolvedMarketingSkin,
} from '@/components/marketing/theme';

export function useMarketingBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    width,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
  };
}

export function MarketingSection({
  skin,
  children,
  style,
}: {
  skin: ResolvedMarketingSkin;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { isMobile } = useMarketingBreakpoint();
  return (
    <View
      style={[
        styles.section,
        {
          paddingVertical: isMobile ? MarketingLayout.sectionYMobile : MarketingLayout.sectionY,
          paddingHorizontal: MarketingLayout.gutter,
        },
        style,
      ]}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

/** A stable visual container for a landing block.
 *
 * Every content block owns a panel instead of relying on the block before it
 * for spacing or background. This is what keeps arbitrary block ordering from
 * turning into a collection of floating texts on wide screens.
 */
export function MarketingPanel({
  skin,
  children,
  style,
}: {
  skin: ResolvedMarketingSkin;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: skin.surface,
          borderColor: skin.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  skin,
  title,
  description,
  align = 'center',
  action,
}: {
  skin: ResolvedMarketingSkin;
  title?: string;
  description?: string;
  align?: 'left' | 'center';
  action?: ReactNode;
}) {
  const { isMobile } = useMarketingBreakpoint();
  if (!title && !description && !action) return null;
  return (
    <View
      style={[
        styles.headerRow,
        align === 'center' && !action ? styles.headerCenter : null,
        action ? styles.headerBetween : null,
      ]}>
      <View style={[styles.headerText, align === 'center' && !action ? styles.headerTextCenter : null]}>
        {title ? (
          <Text
            style={[
              isMobile ? MarketingType.sectionMobile : MarketingType.section,
              { color: skin.text, textAlign: align === 'center' && !action ? 'center' : 'left' },
            ]}>
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text
            style={[
              MarketingType.bodyLg,
              {
                color: skin.textSecondary,
                marginTop: 10,
                textAlign: align === 'center' && !action ? 'center' : 'left',
                maxWidth: 720,
              },
            ]}>
            {description}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function MarketingButton({
  skin,
  label,
  onPress,
  variant = 'primary',
}: {
  skin: ResolvedMarketingSkin;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'surface';
}) {
  const bg =
    variant === 'primary'
      ? skin.accentColor
      : variant === 'secondary'
        ? 'rgba(255,255,255,0.08)'
        : variant === 'surface'
          ? skin.surfaceElevated
          : 'transparent';
  const color =
    variant === 'primary' ? skin.colors.onAccent : skin.text;
  const borderColor =
    variant === 'ghost' || variant === 'secondary' ? skin.border : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'ghost' || variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <Text style={[MarketingType.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function MarketingCard({
  skin,
  children,
  style,
}: {
  skin: ResolvedMarketingSkin;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: skin.surface,
          borderColor: skin.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function CoverImage({
  uri,
  style,
  priority = false,
}: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  priority?: boolean;
}) {
  if (!uri) {
    return (
      <View style={[styles.coverFallback, style]}>
        <View style={styles.coverFallbackGlow} />
        <View style={styles.coverFallbackMark} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style as never}
      contentFit="cover"
      recyclingKey={uri}
      {...(priority ? { priority: 'high' as const } : { priority: 'low' as const })}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: MarketingLayout.maxWidth,
    gap: 28,
  },
  panel: {
    width: '100%',
    borderRadius: MarketingLayout.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 28,
    gap: 24,
  },
  headerRow: {
    width: '100%',
    gap: 16,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 200,
    gap: 0,
  },
  headerTextCenter: {
    alignItems: 'center',
  },
  btn: {
    minHeight: 48,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: MarketingLayout.radiusPill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  card: {
    borderRadius: MarketingLayout.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  coverFallback: {
    backgroundColor: '#1A2A42',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackGlow: {
    position: 'absolute',
    width: '78%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(117, 87, 228, 0.38)',
    top: '-34%',
    right: '-16%',
  },
  coverFallbackMark: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
