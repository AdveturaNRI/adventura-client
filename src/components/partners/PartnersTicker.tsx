import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { Partner } from '@/data/partners/partners';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { getPartnersCache, listPartners } from '@/services/partners/partnersApi';

const ITEM_GAP = 12;
const SPEED_PX_PER_SEC = 36;

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      gap: Spacing.sm,
    },
    header: {
      paddingHorizontal: 2,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: colors.text,
    },
    root: {
      width: '100%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      paddingVertical: 10,
    },
    track: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    set: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ITEM_GAP,
      paddingRight: ITEM_GAP,
    },
    staticRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: ITEM_GAP,
      paddingHorizontal: Spacing.sm,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    mark: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    logo: {
      width: 28,
      height: 28,
      borderRadius: 8,
    },
    name: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.1,
    },
  });
}

function PartnerChip({
  partner,
  styles,
  onPress,
}: {
  partner: Partner;
  styles: ReturnType<typeof createStyles>;
  onPress: (partner: Partner) => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Партнёр ${partner.name}`}
      onPress={() => onPress(partner)}
      style={({ pressed }) => [styles.item, pressed && { opacity: 0.82 }]}>
      {partner.logoUrl ? (
        <Image source={{ uri: partner.logoUrl }} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.mark, { backgroundColor: partner.accent }]}>
          <Text style={styles.markText}>{partner.mark}</Text>
        </View>
      )}
      <Text style={styles.name}>{partner.name}</Text>
    </Pressable>
  );
}

type PartnersTickerProps = {
  partners?: Partner[];
};

export function PartnersTicker({ partners: partnersProp }: PartnersTickerProps) {
  const styles = useThemedStyles(createStyles);
  const translateX = useSharedValue(0);
  const [setWidth, setSetWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [loadedPartners, setLoadedPartners] = useState<Partner[]>(
    () => getPartnersCache() ?? [],
  );
  const [ready, setReady] = useState(() => getPartnersCache() != null || partnersProp != null);

  useEffect(() => {
    if (partnersProp != null) {
      setReady(true);
      return;
    }

    let mounted = true;
    void listPartners().then((rows) => {
      if (!mounted) {
        return;
      }
      setLoadedPartners(rows);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [partnersProp]);

  const items = useMemo(() => {
    if (partnersProp != null) {
      return partnersProp;
    }
    return loadedPartners;
  }, [loadedPartners, partnersProp]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    cancelAnimation(translateX);
    translateX.value = 0;

    if (reduceMotion || setWidth <= 0 || items.length === 0) {
      return;
    }

    const duration = Math.max(12_000, (setWidth / SPEED_PX_PER_SEC) * 1000);
    translateX.value = withRepeat(
      withTiming(-setWidth, { duration, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [items.length, reduceMotion, setWidth, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const openPartner = (partner: Partner) => {
    void Linking.openURL(partner.href);
  };

  const onSetLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.width);
    if (next > 0 && next !== setWidth) {
      setSetWidth(next);
    }
  };

  if (!ready || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Наши партнёры">
      <View style={styles.header}>
        <Text style={styles.title}>Наши партнёры</Text>
      </View>
      <View
        style={styles.root}
        accessibilityRole={Platform.OS === 'web' ? 'list' : undefined}
        accessibilityLabel="Список партнёров">
        {reduceMotion ? (
          <View style={styles.staticRow}>
            {items.map((partner) => (
              <PartnerChip key={partner.id} partner={partner} styles={styles} onPress={openPartner} />
            ))}
          </View>
        ) : (
          <Animated.View style={[styles.track, { paddingLeft: Spacing.sm }, animatedStyle]}>
            <View style={styles.set} onLayout={onSetLayout}>
              {items.map((partner) => (
                <PartnerChip key={partner.id} partner={partner} styles={styles} onPress={openPartner} />
              ))}
            </View>
            <View style={styles.set} importantForAccessibility="no-hide-descendants">
              {items.map((partner) => (
                <PartnerChip
                  key={`dup-${partner.id}`}
                  partner={partner}
                  styles={styles}
                  onPress={openPartner}
                />
              ))}
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
