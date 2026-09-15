import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { DieMeshPreview, DieMeshPreviewProvider } from '@/components/dice/DieMeshPreview';
import { DiceColorPicker } from '@/components/dice/DiceColorPicker';
import { useIsDesktopWeb } from '@/components/navigation/DesktopThemeToggle';
import { FontSize, Spacing } from '@/constants/theme';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import {
  CHAT_DIE_SIDES,
  CHAT_MAX_PER_DIE,
  CHAT_MAX_TOTAL_DICE,
  formatDiceFormula,
  type ChatDieSides,
} from '@/utils/chat-dice-roll';

type Pool = Record<ChatDieSides, number>;

const EMPTY_POOL: Pool = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };
const PREVIEW_SIZE = 40;

/** Палитра как у рейла на экране «Дайсы». */
const DICE_UI = {
  sheet: '#101820',
  sheetBorder: 'rgba(21, 122, 254, 0.2)',
  backdrop: 'rgba(8, 12, 20, 0.55)',
  text: '#E8EEF8',
  textMuted: 'rgba(132, 185, 255, 0.72)',
  chip: 'rgba(255, 255, 255, 0.04)',
  chipActive: 'rgba(21, 122, 254, 0.18)',
  chipBorder: 'rgba(21, 122, 254, 0.22)',
  chipBorderActive: 'rgba(21, 122, 254, 0.45)',
  control: 'rgba(255, 255, 255, 0.08)',
  controlBorder: 'rgba(21, 122, 254, 0.28)',
  accent: '#157AFE',
  accentSoft: 'rgba(21, 122, 254, 0.12)',
  accentSoftOn: 'rgba(21, 122, 254, 0.22)',
  label: '#84B9FF',
} as const;

type ChatDicePopoverProps = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onRoll: (input: {
    dice: { sides: number; qty: number }[];
    modifier: number;
    hidden: boolean;
    color: string;
  }) => void;
};

function createStyles(isDesktop: boolean) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: DICE_UI.backdrop,
      justifyContent: isDesktop ? 'center' : 'flex-end',
      alignItems: isDesktop ? 'center' : 'stretch',
      padding: isDesktop ? Spacing.lg : 0,
    },
    sheet: {
      backgroundColor: DICE_UI.sheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktop ? 20 : 0,
      borderBottomRightRadius: isDesktop ? 20 : 0,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.lg,
      gap: Spacing.md,
      maxWidth: isDesktop ? 440 : undefined,
      width: isDesktop ? '100%' : undefined,
      borderWidth: 1,
      borderColor: DICE_UI.sheetBorder,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    title: {
      fontSize: FontSize.button,
      fontWeight: '700',
      color: DICE_UI.text,
    },
    formula: {
      fontSize: FontSize.caption,
      color: DICE_UI.label,
      fontWeight: '600',
    },
    colorRow: {
      gap: 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    dieChip: {
      width: '31%',
      minWidth: 96,
      flexGrow: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: DICE_UI.chipBorder,
      backgroundColor: DICE_UI.chip,
      alignItems: 'center',
      gap: 6,
    },
    dieChipActive: {
      borderColor: DICE_UI.chipBorderActive,
      backgroundColor: DICE_UI.chipActive,
    },
    diePreview: {
      width: PREVIEW_SIZE,
      height: PREVIEW_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dieLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: DICE_UI.label,
      letterSpacing: 0.2,
    },
    dieLabelMuted: {
      opacity: 0.72,
    },
    dieControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DICE_UI.control,
      borderWidth: 1,
      borderColor: DICE_UI.controlBorder,
    },
    qtyText: {
      minWidth: 16,
      textAlign: 'center',
      fontWeight: '700',
      color: DICE_UI.text,
      fontSize: FontSize.label,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    rowLabel: {
      fontSize: FontSize.label,
      fontWeight: '600',
      color: DICE_UI.text,
    },
    modControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    modValue: {
      minWidth: 36,
      textAlign: 'center',
      fontWeight: '700',
      color: DICE_UI.label,
      fontSize: FontSize.button,
    },
    hiddenToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: DICE_UI.accentSoft,
      borderWidth: 1,
      borderColor: DICE_UI.controlBorder,
    },
    hiddenToggleOn: {
      backgroundColor: DICE_UI.accentSoftOn,
      borderColor: DICE_UI.accent,
    },
    hiddenText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: DICE_UI.label,
    },
    rollButton: {
      marginTop: 4,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DICE_UI.accent,
      flexDirection: 'row',
      gap: 8,
    },
    rollButtonDisabled: {
      opacity: 0.45,
    },
    rollButtonText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: FontSize.button,
    },
  });
}

export function ChatDicePopover({ visible, busy, onClose, onRoll }: ChatDicePopoverProps) {
  const isDesktop = useIsDesktopWeb();
  const styles = useMemo(() => createStyles(isDesktop), [isDesktop]);
  const { accent, setAccent } = useDiceAccentColor();
  const [pool, setPool] = useState<Pool>({ ...EMPTY_POOL, 20: 1 });
  const [modifier, setModifier] = useState(0);
  const [hidden, setHidden] = useState(false);

  const total = useMemo(
    () => CHAT_DIE_SIDES.reduce((sum, sides) => sum + pool[sides], 0),
    [pool],
  );

  const formula = useMemo(() => {
    const dice = CHAT_DIE_SIDES.filter((sides) => pool[sides] > 0).map((sides) => ({
      sides,
      qty: pool[sides],
    }));
    return formatDiceFormula(dice, modifier) || '—';
  }, [modifier, pool]);

  const canRoll = total > 0 && !busy;

  const bump = (sides: ChatDieSides, delta: number) => {
    setPool((prev) => {
      const nextQty = Math.max(0, Math.min(CHAT_MAX_PER_DIE, prev[sides] + delta));
      if (delta > 0 && total - prev[sides] + nextQty > CHAT_MAX_TOTAL_DICE) {
        return prev;
      }
      return { ...prev, [sides]: nextQty };
    });
  };

  const handleRoll = () => {
    if (!canRoll) {
      return;
    }
    const dice = CHAT_DIE_SIDES.filter((sides) => pool[sides] > 0).map((sides) => ({
      sides,
      qty: pool[sides],
    }));
    onRoll({ dice, modifier, hidden, color: accent });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isDesktop ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Быстрый бросок</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={onClose}>
              <Ionicons name="close" size={22} color={DICE_UI.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.formula}>{formula}</Text>

          <View style={styles.colorRow}>
            <DiceColorPicker
              value={accent}
              compact
              disabled={busy}
              onChange={(hex) => {
                void setAccent(hex);
              }}
            />
          </View>

          <DieMeshPreviewProvider>
            <View style={styles.grid}>
              {CHAT_DIE_SIDES.map((sides) => {
                const qty = pool[sides];
                const active = qty > 0;
                return (
                  <View
                    key={sides}
                    style={[styles.dieChip, active ? styles.dieChipActive : null]}>
                    <View style={styles.diePreview}>
                      <DieMeshPreview
                        sides={sides}
                        size={PREVIEW_SIZE}
                        active={active || total === 0}
                        themeColor={accent}
                      />
                    </View>
                    <Text style={[styles.dieLabel, !active ? styles.dieLabelMuted : null]}>
                      d{sides}
                    </Text>
                    <View style={styles.dieControls}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Меньше d${sides}`}
                        onPress={() => bump(sides, -1)}
                        style={styles.qtyBtn}>
                        <Ionicons name="remove" size={14} color={DICE_UI.label} />
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Больше d${sides}`}
                        onPress={() => bump(sides, 1)}
                        style={styles.qtyBtn}>
                        <Ionicons name="add" size={14} color={DICE_UI.label} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </DieMeshPreviewProvider>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Модификатор</Text>
            <View style={styles.modControls}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setModifier((v) => Math.max(-99, v - 1))}
                style={styles.qtyBtn}>
                <Ionicons name="remove" size={14} color={DICE_UI.label} />
              </Pressable>
              <Text style={styles.modValue}>
                {modifier > 0 ? `+${modifier}` : String(modifier)}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setModifier((v) => Math.min(99, v + 1))}
                style={styles.qtyBtn}>
                <Ionicons name="add" size={14} color={DICE_UI.label} />
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: hidden }}
            onPress={() => setHidden((v) => !v)}
            style={[styles.hiddenToggle, hidden ? styles.hiddenToggleOn : null]}>
            <Ionicons
              name={hidden ? 'eye-off' : 'eye-outline'}
              size={16}
              color={DICE_UI.label}
            />
            <Text style={styles.hiddenText}>
              {hidden ? 'Скрытый бросок' : 'Результат видят все'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!canRoll}
            onPress={handleRoll}
            style={[styles.rollButton, !canRoll ? styles.rollButtonDisabled : null]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="dice-outline" size={18} color="#FFFFFF" />
                <Text style={styles.rollButtonText}>Бросить</Text>
              </>
            )}
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
