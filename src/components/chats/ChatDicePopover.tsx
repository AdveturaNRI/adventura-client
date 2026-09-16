import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  type DiceRollMode,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationSpeedSync,
  loadDiceAnimationSpeed,
  saveDiceAnimationSpeed,
  type DiceAnimationSpeed,
} from '@/utils/dice-animations-storage';

type Pool = Record<ChatDieSides, number>;

const EMPTY_POOL: Pool = { 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 20: 0, 100: 0 };
const ADVANTAGE_POOL: Pool = { ...EMPTY_POOL, 20: 2 };
const PREVIEW_SIZE = 40;

const DICE_SPEED_OPTIONS: {
  value: DiceAnimationSpeed;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    value: 'normal',
    icon: 'arrow-forward',
    accessibilityLabel: 'Обычная скорость анимации',
  },
  {
    value: 'fast',
    icon: 'play-forward',
    accessibilityLabel: 'Быстрая анимация кубиков',
  },
  {
    value: 'off',
    icon: 'close',
    accessibilityLabel: 'Без анимации кубиков',
  },
];

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
    mode: DiceRollMode;
  }) => void;
};

function createStyles(isDesktop: boolean) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 55,
      elevation: 55,
      justifyContent: isDesktop ? 'center' : 'flex-end',
      alignItems: isDesktop ? 'center' : 'stretch',
      padding: isDesktop ? Spacing.lg : 0,
    },
    rootHidden: {
      opacity: 0,
    },
    backdropPress: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: DICE_UI.backdrop,
    },
    sheet: {
      backgroundColor: DICE_UI.sheet,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: isDesktop ? 20 : 0,
      borderBottomRightRadius: isDesktop ? 20 : 0,
      paddingTop: Spacing.md,
      maxWidth: isDesktop ? 440 : undefined,
      width: isDesktop ? '100%' : undefined,
      borderWidth: 1,
      borderColor: DICE_UI.sheetBorder,
      zIndex: 1,
      maxHeight: '100%',
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    sheetScroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    sheetScrollContent: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    sheetFooter: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.lg,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(21, 122, 254, 0.18)',
    },
    closeBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
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
      gap: 8,
    },
    rowLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: DICE_UI.label,
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
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    modeChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: DICE_UI.controlBorder,
      backgroundColor: DICE_UI.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipOn: {
      backgroundColor: DICE_UI.accentSoftOn,
      borderColor: DICE_UI.accent,
    },
    modeChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: DICE_UI.label,
    },
    modeChipTextOn: {
      color: '#FFFFFF',
    },
    speedRow: {
      gap: 6,
    },
    speedLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: DICE_UI.label,
    },
    speedSegment: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      gap: 6,
    },
    speedChip: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: DICE_UI.controlBorder,
      backgroundColor: DICE_UI.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedChipOn: {
      backgroundColor: DICE_UI.accent,
      borderColor: DICE_UI.accent,
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

/**
 * Не Modal: RN Modal при закрытии размонтирует детей и каждый раз заново
 * поднимает 7 WebGL-превью. Держим шит в absolute overlay после первого открытия.
 */
export function ChatDicePopover({ visible, busy, onClose, onRoll }: ChatDicePopoverProps) {
  const isDesktop = useIsDesktopWeb();
  const styles = useMemo(() => createStyles(isDesktop), [isDesktop]);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { accent, setAccent } = useDiceAccentColor();
  const [keptAlive, setKeptAlive] = useState(false);
  const [pool, setPool] = useState<Pool>({ ...EMPTY_POOL, 20: 1 });
  const [modifier, setModifier] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [mode, setMode] = useState<DiceRollMode>('normal');
  const [animationSpeed, setAnimationSpeed] = useState<DiceAnimationSpeed>(
    getDiceAnimationSpeedSync,
  );

  const sheetMaxHeight = isDesktop
    ? undefined
    : Math.max(320, windowHeight - Math.max(insets.top, 8) - 8);

  useEffect(() => {
    if (visible) {
      setKeptAlive(true);
      void loadDiceAnimationSpeed().then(setAnimationSpeed);
    }
  }, [visible]);

  const handleAnimationSpeedChange = (next: DiceAnimationSpeed) => {
    setAnimationSpeed(next);
    void saveDiceAnimationSpeed(next);
  };

  const total = useMemo(
    () => CHAT_DIE_SIDES.reduce((sum, sides) => sum + pool[sides], 0),
    [pool],
  );

  const formula = useMemo(() => {
    const dice = CHAT_DIE_SIDES.filter((sides) => pool[sides] > 0).map((sides) => ({
      sides,
      qty: pool[sides],
    }));
    return formatDiceFormula(dice, modifier, mode) || '—';
  }, [mode, modifier, pool]);

  const canRoll = total > 0 && !busy;
  const keepMode = mode !== 'normal';

  const setKeepMode = (next: DiceRollMode) => {
    setMode((prev) => {
      const resolved = prev === next ? 'normal' : next;
      if (resolved === 'advantage' || resolved === 'disadvantage') {
        setPool({ ...ADVANTAGE_POOL });
      }
      return resolved;
    });
  };

  const bump = (sides: ChatDieSides, delta: number) => {
    if (keepMode) {
      return;
    }
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
    const dice =
      mode === 'advantage' || mode === 'disadvantage'
        ? [{ sides: 20, qty: 2 }]
        : CHAT_DIE_SIDES.filter((sides) => pool[sides] > 0).map((sides) => ({
            sides,
            qty: pool[sides],
          }));
    onRoll({ dice, modifier, hidden, color: accent, mode });
  };

  if (!visible && !keptAlive) {
    return null;
  }

  return (
    <View
      style={[styles.root, !visible ? styles.rootHidden : null]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрыть быстрый бросок"
        disabled={!visible}
        onPress={onClose}
        style={styles.backdropPress}
      />
      <View
        style={[
          styles.sheet,
          sheetMaxHeight != null ? { maxHeight: sheetMaxHeight } : null,
          { paddingBottom: isDesktop ? Spacing.lg : Math.max(insets.bottom, Spacing.md) },
        ]}
        pointerEvents="box-none">
        <View style={styles.sheetHeader}>
          <Text style={styles.title}>Быстрый бросок</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
            hitSlop={12}
            onPress={onClose}
            style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={DICE_UI.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
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

          <View style={styles.modeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'advantage' }}
              disabled={busy}
              onPress={() => setKeepMode('advantage')}
              style={[styles.modeChip, mode === 'advantage' ? styles.modeChipOn : null]}>
              <Text
                style={[
                  styles.modeChipText,
                  mode === 'advantage' ? styles.modeChipTextOn : null,
                ]}>
                Преимущество
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'disadvantage' }}
              disabled={busy}
              onPress={() => setKeepMode('disadvantage')}
              style={[styles.modeChip, mode === 'disadvantage' ? styles.modeChipOn : null]}>
              <Text
                style={[
                  styles.modeChipText,
                  mode === 'disadvantage' ? styles.modeChipTextOn : null,
                ]}>
                Помеха
              </Text>
            </Pressable>
          </View>

          <View style={styles.speedRow}>
            <Text style={styles.speedLabel}>Анимация</Text>
            <View style={styles.speedSegment}>
              {DICE_SPEED_OPTIONS.map((option) => {
                const selected = animationSpeed === option.value;
                const iconColor = selected ? '#FFFFFF' : DICE_UI.label;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={option.accessibilityLabel}
                    accessibilityState={{ selected }}
                    disabled={busy}
                    onPress={() => handleAnimationSpeedChange(option.value)}
                    style={[styles.speedChip, selected ? styles.speedChipOn : null]}>
                    {option.value === 'fast' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="arrow-forward" size={12} color={iconColor} />
                        <Ionicons name="arrow-forward" size={12} color={iconColor} />
                      </View>
                    ) : (
                      <Ionicons name={option.icon} size={16} color={iconColor} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <DieMeshPreviewProvider>
            <View style={[styles.grid, keepMode ? { opacity: 0.55 } : null]}>
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
                        disabled={busy || keepMode}
                        onPress={() => bump(sides, -1)}
                        style={styles.qtyBtn}>
                        <Ionicons name="remove" size={14} color={DICE_UI.label} />
                      </Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Больше d${sides}`}
                        disabled={busy || keepMode}
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
        </ScrollView>

        <View style={styles.sheetFooter}>
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
        </View>
      </View>
    </View>
  );
}
