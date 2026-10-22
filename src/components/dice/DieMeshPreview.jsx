import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { DIE_SVG_BY_SIDES } from '@/components/dice/die-svg-assets';
import { FontSize } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { coerceDiceAccent } from '@/utils/dice-color-storage';

function dieLabel(sides) {
  return `d${sides}`;
}

function parseHex(hex) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]) {
  return (
    '#' +
    [r, g, b]
      .map((v) =>
        Math.max(0, Math.min(255, Math.round(v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function tintDieSvg(svgText, accentHex, idSuffix) {
  const accent = parseHex(coerceDiceAccent(accentHex));
  const faceHexes = new Set();
  const fillRe = /fill="(#[0-9A-Fa-f]{3,8})"/g;
  let match;
  while ((match = fillRe.exec(svgText))) {
    const hex = match[1];
    const lower = hex.toLowerCase();
    if (lower === '#fff' || lower === '#ffffff') continue;
    faceHexes.add(hex);
  }

  let maxFaceLum = 0;
  for (const hex of faceHexes) {
    maxFaceLum = Math.max(maxFaceLum, luminance(parseHex(hex)));
  }
  if (maxFaceLum < 1) maxFaceLum = 189;

  let out = svgText;
  for (const hex of faceHexes) {
    const lum = luminance(parseHex(hex));
    const t = Math.pow(lum / maxFaceLum, 0.9);
    const tinted = toHex([accent[0] * t, accent[1] * t, accent[2] * t]);
    out = out.split(`fill="${hex}"`).join(`fill="${tinted}"`);
  }

  out = out.replace(/\bid="([^"]+)"/g, (_m, id) => `id="${id}_${idSuffix}"`);
  out = out.replace(/url\(#([^)]+)\)/g, (_m, id) => `url(#${id}_${idSuffix})`);

  return out;
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

export function DieMeshPreviewProvider({ children }) {
  return <>{children}</>;
}

export function DieMeshPreview({
  sides,
  size = 56,
  active = true,
  themeColor,
}) {
  const colors = useTheme();
  const accent = themeColor?.trim() || colors.primary;
  const raw = DIE_SVG_BY_SIDES[sides];

  const xml = useMemo(
    () => (raw ? tintDieSvg(raw, accent, `${sides}`) : ''),
    [accent, raw, sides],
  );

  if (!xml) {
    return <DieTextFallback sides={sides} size={size} active={active} themeColor={accent} />;
  }

  return (
    <View style={{ width: size, height: size, opacity: active ? 1 : 0.45 }}>
      <SvgXml xml={xml} width={size} height={size} />
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
