import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type CrownOffIconProps = {
  size?: number;
  color?: string;
  /** Background behind the strike so it cuts the crown cleanly. */
  haloColor?: string;
  style?: StyleProp<ViewStyle>;
};

/** Crown with a diagonal strike — MaterialCommunityIcons has no crown-off glyph. */
export function CrownOffIcon({
  size = 18,
  color = '#9A6B2F',
  haloColor,
  style,
}: CrownOffIconProps) {
  const slashHeight = Math.max(1.5, size * 0.12);
  const slashWidth = size * 1.15;
  const resolvedHalo = haloColor ?? 'rgba(255, 248, 225, 0.92)';

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <MaterialCommunityIcons name="crown" size={size} color={color} />
      <View
        pointerEvents="none"
        style={[
          styles.slashHalo,
          {
            width: slashWidth,
            height: slashHeight + 2,
            borderRadius: slashHeight,
            backgroundColor: resolvedHalo,
            transform: [{ rotate: '-42deg' }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.slash,
          {
            width: slashWidth,
            height: slashHeight,
            backgroundColor: color,
            borderRadius: slashHeight,
            transform: [{ rotate: '-42deg' }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  slashHalo: {
    position: 'absolute',
  },
  slash: {
    position: 'absolute',
  },
});
