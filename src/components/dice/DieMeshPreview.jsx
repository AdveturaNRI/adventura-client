import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { coerceDiceAccent, DICE_ACCENT_PALETTE } from '@/utils/dice-color-storage';

const PALETTE_HEX = new Set(
  DICE_ACCENT_PALETTE.map((item) => item.hex.slice(1).toUpperCase()),
);

function dieLabel(sides) {
  return `d${sides}`;
}

function nearestPaletteHex(accent) {
  const normalized = coerceDiceAccent(accent).slice(1).toUpperCase();
  if (PALETTE_HEX.has(normalized)) {
    return normalized;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  let best = '157AFE';
  let bestDist = Infinity;
  for (const hex of PALETTE_HEX) {
    const dr = r - parseInt(hex.slice(0, 2), 16);
    const dg = g - parseInt(hex.slice(2, 4), 16);
    const db = b - parseInt(hex.slice(4, 6), 16);
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = hex;
    }
  }
  return best;
}

function previewSrc(sides, accent) {
  const hex = nearestPaletteHex(accent);
  const label = dieLabel(sides);
  if (sides === 100) {
    return `/dice-previews/${hex}/${label}.png?v=even1`;
  }
  return `/dice-previews/${hex}/${label}.svg?v=svg1`;
}

function DieTextFallback({ sides, size, active, themeColor }) {
  const colors = useTheme();
  const label = dieLabel(sides);
  const fontSize = Math.max(12, Math.round(size * (label.length > 3 ? 0.28 : 0.34)));
  const tint = themeColor || colors.primary;

  return (
    <View
      style={[
        styles.textWrap,
        {
          width: size,
          height: size,
          opacity: active ? 1 : 0.45,
          borderColor: active ? tint : colors.border,
          backgroundColor: active ? `${tint}22` : 'transparent',
        },
      ]}>
      <Text style={[styles.textLabel, { color: tint, fontSize }]}>{label}</Text>
    </View>
  );
}

/** No-op provider — previews are static PNGs from public/dice-previews. */
export function DieMeshPreviewProvider({ children }) {
  return <>{children}</>;
}

/**
 * Static die art tinted to the selected dice accent
 * (`assets/dice` → colorized into `public/dice-previews/{HEX}`).
 */
export function DieMeshPreview({
  sides,
  size = 56,
  active = true,
  themeColor,
}) {
  const colors = useTheme();
  const accent = themeColor?.trim() || colors.primary;
  const src = useMemo(() => previewSrc(sides, accent), [accent, sides]);

  if (Platform.OS !== 'web' || !src) {
    return <DieTextFallback sides={sides} size={size} active={active} themeColor={accent} />;
  }

  return (
    <View style={{ width: size, height: size, opacity: active ? 1 : 0.45 }}>
      <Image
        source={{ uri: src }}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        recyclingKey={src}
        transition={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  textLabel: {
    fontWeight: '800',
    letterSpacing: 0.2,
    includeFontPadding: false,
    fontSize: FontSize.caption,
  },
});
