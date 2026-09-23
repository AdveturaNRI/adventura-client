import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontSize } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { DICE_ACCENT_PALETTE, } from '@/utils/dice-color-storage';
function createStyles(colors) {
    return StyleSheet.create({
        root: {
            gap: 4,
        },
        rootInline: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            rowGap: 4,
        },
        label: {
            fontSize: FontSize.caption,
            fontWeight: '600',
            color: colors.primaryLight,
        },
        row: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        rowCompact: {
            flexWrap: 'nowrap',
            gap: 5,
            justifyContent: 'space-between',
        },
        swatch: {
            width: 28,
            height: 28,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: 'transparent',
        },
        swatchCompact: {
            width: 22,
            height: 22,
            flexShrink: 1,
        },
        swatchSelected: {
            borderColor: colors.text,
        },
        swatchLight: {
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.18)',
        },
    });
}
function isLightHex(hex) {
    const raw = hex.replace('#', '');
    if (raw.length !== 6)
        return false;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 180;
}
export function DiceColorPicker({ value, onChange, disabled, compact, }) {
    const styles = useThemedStyles(createStyles);
    const selected = value.toLowerCase();
    return (<View style={[styles.root, !compact && styles.rootInline]}>
      {!compact ? <Text style={styles.label}>Цвет кубиков</Text> : null}
      <View style={[styles.row, compact && styles.rowCompact]}>
        {DICE_ACCENT_PALETTE.map((option) => {
            const active = option.hex.toLowerCase() === selected;
            return (<Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`Цвет кубиков: ${option.label}`} accessibilityState={{ selected: active, disabled: Boolean(disabled) }} disabled={disabled} onPress={() => onChange(option.hex)} style={({ pressed }) => [
                    styles.swatch,
                    compact && styles.swatchCompact,
                    { backgroundColor: option.hex },
                    isLightHex(option.hex) && styles.swatchLight,
                    active && styles.swatchSelected,
                    pressed && !disabled && { opacity: 0.85 },
                    disabled && { opacity: 0.45 },
                ]}/>);
        })}
      </View>
    </View>);
}
