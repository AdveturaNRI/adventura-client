import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DICE_SKIN_IDS,
  DICE_SKINS,
  type DiceSkinId,
} from '@/data/rewards/catalog';
import { FontSize, Radius, Spacing } from '@/constants/theme';

type Props = {
  value: DiceSkinId;
  unlockedIds: DiceSkinId[];
  onChange: (id: DiceSkinId) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function DiceSkinPicker({ value, unlockedIds, onChange, disabled, compact }: Props) {
  const owned = DICE_SKIN_IDS.filter((id) => unlockedIds.includes(id));
  if (owned.length <= 1) {
    return null;
  }

  return (
    <View style={styles.root}>
      {!compact ? <Text style={styles.label}>Скин кубиков</Text> : null}
      <View style={[styles.row, compact && styles.rowCompact]}>
        {owned.map((id) => {
          const spec = DICE_SKINS[id];
          const active = value === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={spec.label}
              accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
              disabled={disabled}
              onPress={() => onChange(id)}
              style={({ pressed }) => [
                styles.chip,
                compact && styles.chipCompact,
                {
                  borderColor: active ? spec.accent : 'rgba(255,255,255,0.12)',
                  backgroundColor: active ? `${spec.accent}22` : 'rgba(255,255,255,0.04)',
                },
                pressed && !disabled ? { opacity: 0.86 } : null,
              ]}>
              <View style={[styles.swatch, { backgroundColor: spec.accent }]} />
              {!compact ? (
                <Text style={styles.chipLabel} numberOfLines={1}>
                  {spec.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  label: {
    fontSize: FontSize.caption,
    fontWeight: '600',
    color: '#84B9FF',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowCompact: {
    flexWrap: 'nowrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipCompact: {
    minHeight: 28,
    paddingHorizontal: 8,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 99,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8EEF8',
  },
});
