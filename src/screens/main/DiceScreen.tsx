import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import type { DieGlyphSides } from '@/components/dice/DieGlyph';
import { DiceColorPicker } from '@/components/dice/DiceColorPicker';
import { DieMeshPreview, DieMeshPreviewProvider } from '@/components/dice/DieMeshPreview';
import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import type { DiceRollOutcome } from '@/components/dice/dice-stage.types';
import { MobileScreenHeader } from '@/components/navigation/MobileScreenHeader';
import { useIsDesktopSidebarVisible } from '@/components/navigation/DesktopThemeToggle';
import { ScreenTransition } from '@/components/navigation/ScreenTransition';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import { useMainScreenStyles } from '@/screens/main/main-screen.styles';
import {
  loadDiceHistory,
  makeHistoryEntry,
  saveDiceHistory,
  type DiceHistoryEntry,
} from '@/utils/dice-roll-history';

export type DieSides = DieGlyphSides;

const DIE_OPTIONS: { sides: DieSides; label: string; fullName: string }[] = [
  { sides: 4, label: 'd4', fullName: 'Четырёхгранник (d4)' },
  { sides: 6, label: 'd6', fullName: 'Шестигранник (d6)' },
  { sides: 8, label: 'd8', fullName: 'Восьмигранник (d8)' },
  { sides: 10, label: 'd10', fullName: 'Десятигранник (d10)' },
  { sides: 12, label: 'd12', fullName: 'Двенадцатигранник (d12)' },
  { sides: 20, label: 'd20', fullName: 'Двадцатигранник (d20)' },
  { sides: 100, label: 'd100', fullName: 'Процентный (d100)' },
];

const DIE_TOOLTIP_DELAY_MS = 280;

const MAX_PER_DIE = 8;
const MAX_TOTAL = 12;
const EMPTY_POOL: Record<DieSides, number> = {
  4: 0,
  6: 0,
  8: 0,
  10: 0,
  12: 0,
  20: 0,
  100: 0,
};
const INITIAL_POOL: Record<DieSides, number> = { ...EMPTY_POOL, 20: 1 };

type Pool = Record<DieSides, number>;

function poolParts(pool: Pool) {
  return DIE_OPTIONS.filter((option) => pool[option.sides] > 0).map(
    (option) => `${pool[option.sides]}d${option.sides}`,
  );
}

function formatTime(at: number) {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      gap: Spacing.sm,
      minHeight: 0,
    },
    workspace: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'row',
      gap: Spacing.md,
      alignItems: 'stretch',
    },
    workspaceCompact: {
      flexDirection: 'column',
      gap: Spacing.sm,
    },

    rail: {
      width: 78,
      borderRadius: 28,
      backgroundColor: '#101820',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.2)',
      paddingTop: 12,
      paddingBottom: 10,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'flex-start',
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as object) : null),
    },
    railMedium: {
      width: 92,
      borderRadius: 32,
      paddingHorizontal: 10,
    },
    railLarge: {
      width: 104,
      borderRadius: 36,
      paddingHorizontal: 12,
    },
    railCompact: {
      width: '100%',
      height: 'auto',
      minHeight: 76,
      borderRadius: 22,
      paddingVertical: 8,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    railScroll: {
      flexGrow: 0,
      flexShrink: 1,
      width: '100%',
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as object) : null),
    },
    railScrollContent: {
      alignItems: 'center',
      gap: 8,
      paddingBottom: 4,
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as object) : null),
    },
    railScrollContentCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 2,
    },
    dieSection: {
      alignItems: 'center',
      gap: 5,
      width: '100%',
      position: 'relative',
      zIndex: 1,
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as object) : null),
    },
    dieSectionCompact: {
      width: 'auto',
      minWidth: 52,
      flexDirection: 'column',
      gap: 4,
    },
    dieHit: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 1,
      ...(Platform.OS === 'web' ? ({ overflow: 'visible' } as object) : null),
    },
    dieHitActive: {
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
    },
    dieHitLg: {
      width: 64,
      height: 64,
      borderRadius: 18,
    },
    dieLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      letterSpacing: 0.2,
      color: colors.primaryLight,
      textAlign: 'center',
    },
    dieLabelMuted: {
      color: colors.primaryLight,
      opacity: 0.72,
    },
    dieTooltip: {
      position: 'absolute',
      zIndex: 20,
      ...(Platform.OS === 'web'
        ? ({
            pointerEvents: 'none',
          } as object)
        : null),
    },
    dieTooltipBeside: {
      left: '100%',
      top: 8,
      marginLeft: 8,
    },
    dieTooltipAbove: {
      bottom: '100%',
      left: 0,
      right: 0,
      marginBottom: 6,
      alignItems: 'center',
    },
    dieTooltipBubble: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 4,
      ...(Platform.OS === 'web'
        ? ({
            whiteSpace: 'nowrap',
          } as object)
        : null),
    },
    dieTooltipText: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    dieBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    dieBadgeText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.onPrimary,
    },
    dieMinus: {
      width: 30,
      height: 22,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    railDivider: {
      width: 32,
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(132, 185, 255, 0.35)',
      marginVertical: 6,
    },
    railDividerCompact: {
      width: StyleSheet.hairlineWidth,
      height: 36,
      backgroundColor: 'rgba(132, 185, 255, 0.35)',
      marginHorizontal: 4,
    },
    railTool: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    railToolDisabled: {
      opacity: 0.35,
    },

    trayColumn: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
    },
    tray: {
      flex: 1,
      minHeight: 240,
      borderRadius: 24,
      borderWidth: 3,
      borderColor: '#2C241C',
      backgroundColor: '#0B1220',
      overflow: 'hidden',
      position: 'relative',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    trayCompact: {
      minHeight: 280,
      borderRadius: 20,
    },
    trayInnerRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.16)',
      pointerEvents: 'none',
      zIndex: 1,
    },
    stageFill: {
      ...StyleSheet.absoluteFillObject,
    },
    rollOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
      pointerEvents: 'box-none',
    },
    rollBtn: {
      minWidth: 156,
      paddingHorizontal: 28,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: colors.primary,
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    rollBtnDisabled: {
      opacity: 0.5,
    },
    rollLabel: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.4,
    },
    statusChip: {
      position: 'absolute',
      top: 12,
      alignSelf: 'center',
      left: 12,
      right: 12,
      zIndex: 4,
      alignItems: 'center',
      pointerEvents: 'none',
    },
    statusPill: {
      maxWidth: '92%',
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: 'rgba(8, 14, 28, 0.72)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
    },
    statusText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primaryLight,
      textAlign: 'center',
    },
    lastResult: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      zIndex: 4,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: 'rgba(8, 14, 28, 0.9)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.35)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    lastResultMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minWidth: 0,
    },
    lastResultSum: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.primary,
      minWidth: 48,
    },
    lastResultMeta: {
      flex: 1,
      gap: 2,
    },
    lastResultNotation: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primaryLight,
    },
    lastResultValues: {
      fontSize: FontSize.label,
      color: '#E8EEF8',
    },
    lastResultDismiss: {
      padding: 6,
    },

    history: {
      width: 200,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.22)',
      backgroundColor: 'rgba(21, 122, 254, 0.06)',
      padding: 12,
      minHeight: 0,
    },
    historyMedium: {
      width: 228,
    },
    historyLarge: {
      width: 268,
      borderRadius: 24,
      padding: 14,
    },
    historyCompact: {
      width: '100%',
      maxHeight: 168,
      borderRadius: 18,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    historyTitle: {
      fontSize: FontSize.caption,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.3,
    },
    historyClear: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    historyClearLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
    },
    historyEmpty: {
      fontSize: FontSize.label,
      color: colors.textSecondary,
      lineHeight: FontSize.label * 1.45,
      paddingVertical: 8,
    },
    historyItem: {
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 9,
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      marginBottom: 6,
      gap: 2,
    },
    historyItemTop: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    historySum: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.primary,
    },
    historyTime: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primaryLight,
    },
    historyNotation: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    historyValues: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    colorBar: {
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
  });
}

export default function DiceScreen() {
  const pageStyles = useMainScreenStyles();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const isFocused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const stageRef = useRef<DiceStageHandle>(null);
  const { accent, setAccent } = useDiceAccentColor();

  const compact = width < 760;
  const medium = width >= 760 && width < 1100;
  const large = width >= 1100;
  const diePreviewSize = large ? 52 : medium ? 46 : 40;

  const [pool, setPool] = useState<Pool>(INITIAL_POOL);
  const [stageReady, setStageReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<DiceRollOutcome | null>(null);
  const [showLast, setShowLast] = useState(false);
  const [history, setHistory] = useState<DiceHistoryEntry[]>([]);
  const [hoveredDie, setHoveredDie] = useState<DieSides | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    setStageReady(false);
  }, [accent]);

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const showDieTooltip = useCallback(
    (sides: DieSides) => {
      if (!isWeb) return;
      clearHoverTimer();
      hoverTimerRef.current = setTimeout(() => {
        setHoveredDie(sides);
      }, DIE_TOOLTIP_DELAY_MS);
    },
    [clearHoverTimer, isWeb],
  );

  const hideDieTooltip = useCallback(() => {
    clearHoverTimer();
    setHoveredDie(null);
  }, [clearHoverTimer]);

  useEffect(() => {
    return () => clearHoverTimer();
  }, [clearHoverTimer]);

  const parts = useMemo(() => poolParts(pool), [pool]);
  const notationLabel = parts.length
    ? parts.join(' + ')
    : 'Выберите кости для броска';
  const totalDice = useMemo(
    () => DIE_OPTIONS.reduce((acc, option) => acc + pool[option.sides], 0),
    [pool],
  );

  useEffect(() => {
    if (isFocused) {
      return;
    }
    setStageReady(false);
    setRolling(false);
  }, [isFocused]);

  useEffect(() => {
    let cancelled = false;
    loadDiceHistory().then((entries) => {
      if (!cancelled) setHistory(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stageReady || rolling) return;
    const timer = setTimeout(() => {
      if (parts.length === 0) {
        stageRef.current?.preview([]);
      } else {
        stageRef.current?.preview(parts.length === 1 ? parts[0] : parts);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [parts, rolling, stageReady]);

  const bump = useCallback((sides: DieSides, delta: number) => {
    setPool((prev) => {
      const current = prev[sides];
      const next = current + delta;
      if (next < 0 || next > MAX_PER_DIE) return prev;
      const total =
        DIE_OPTIONS.reduce((acc, option) => acc + prev[option.sides], 0) - current + next;
      if (total > MAX_TOTAL) return prev;
      return { ...prev, [sides]: next };
    });
  }, []);

  const clearPool = useCallback(() => {
    setPool({ ...EMPTY_POOL });
    stageRef.current?.clear();
    setShowLast(false);
  }, []);

  const pushHistory = useCallback((next: DiceRollOutcome) => {
    setHistory((prev) => {
      const entries = [makeHistoryEntry(next), ...prev].slice(0, 40);
      void saveDiceHistory(entries);
      return entries;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    void saveDiceHistory([]);
  }, []);

  const handleRoll = useCallback(async () => {
    if (rolling || !stageReady || parts.length === 0) return;
    setRolling(true);
    setShowLast(false);
    try {
      await stageRef.current?.roll(parts.length === 1 ? parts[0] : parts);
    } catch {
      setRolling(false);
    }
  }, [parts, rolling, stageReady]);

  const handleDone = useCallback(
    (next: DiceRollOutcome) => {
      setOutcome(next);
      setRolling(false);
      setShowLast(true);
      pushHistory(next);
    },
    [pushHistory],
  );

  const dieRail = (
    <View
      style={[
        styles.rail,
        medium && styles.railMedium,
        large && styles.railLarge,
        compact && styles.railCompact,
        !compact && height < 700 && { paddingTop: 8, paddingBottom: 8 },
      ]}>
      <ScrollView
        horizontal={compact}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.railScrollContent,
          compact && styles.railScrollContentCompact,
        ]}
        style={styles.railScroll}>
        {DIE_OPTIONS.map((option) => {
          const count = pool[option.sides];
          const active = count > 0;
          const canPlus = count < MAX_PER_DIE && totalDice < MAX_TOTAL;
          const showTooltip = isWeb && hoveredDie === option.sides;
          return (
            <View
              key={option.sides}
              style={[
                styles.dieSection,
                compact && styles.dieSectionCompact,
                rolling && { opacity: 0.55 },
                showTooltip && { zIndex: 30 },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${option.fullName}. Добавить, сейчас ${count}`}
                disabled={rolling || !canPlus}
                onPress={() => bump(option.sides, 1)}
                onHoverIn={() => showDieTooltip(option.sides)}
                onHoverOut={hideDieTooltip}
                style={({ pressed }) => [
                  styles.dieHit,
                  (medium || large) && styles.dieHitLg,
                  active && styles.dieHitActive,
                  pressed && canPlus && { opacity: 0.88 },
                ]}>
                {active ? (
                  <View style={styles.dieBadge}>
                    <Text style={styles.dieBadgeText}>{count}</Text>
                  </View>
                ) : null}
                <DieMeshPreview
                  sides={option.sides}
                  size={compact ? 36 : diePreviewSize}
                  active={active || totalDice === 0}
                  themeColor={accent}
                />
                {showTooltip ? (
                  <View
                    style={[
                      styles.dieTooltip,
                      compact ? styles.dieTooltipAbove : styles.dieTooltipBeside,
                    ]}
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants">
                    <View style={styles.dieTooltipBubble}>
                      <Text style={styles.dieTooltipText}>{option.fullName}</Text>
                    </View>
                  </View>
                ) : null}
              </Pressable>
              <Text
                style={[styles.dieLabel, !active && styles.dieLabelMuted]}
                numberOfLines={1}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                {option.label}
              </Text>
              {active ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Убрать ${option.label}`}
                  disabled={rolling}
                  onPress={() => bump(option.sides, -1)}
                  style={({ pressed }) => [
                    styles.dieMinus,
                    pressed && { opacity: 0.85 },
                  ]}>
                  <Ionicons name="remove" size={14} color={colors.primaryLight} />
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <View style={compact ? styles.railDividerCompact : styles.railDivider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Сбросить набор"
          disabled={rolling || totalDice === 0}
          onPress={clearPool}
          style={({ pressed }) => [
            styles.railTool,
            (rolling || totalDice === 0) && styles.railToolDisabled,
            pressed && totalDice > 0 && { opacity: 0.85 },
          ]}>
          <Ionicons name="trash-outline" size={18} color={colors.primaryLight} />
        </Pressable>
      </ScrollView>
    </View>
  );

  const historyPanel = (
    <View
      style={[
        styles.history,
        medium && styles.historyMedium,
        large && styles.historyLarge,
        compact && styles.historyCompact,
      ]}>
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>История бросков</Text>
        {history.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearHistory}
            style={({ pressed }) => [styles.historyClear, pressed && { opacity: 0.85 }]}>
            <Text style={styles.historyClearLabel}>Очистить</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>
            Здесь появятся результаты: сумма, нотация и значения по костям.
          </Text>
        ) : (
          history.map((entry) => (
            <View key={entry.id} style={styles.historyItem}>
              <View style={styles.historyItemTop}>
                <Text style={styles.historySum}>{entry.sum}</Text>
                <Text style={styles.historyTime}>{formatTime(entry.at)}</Text>
              </View>
              <Text style={styles.historyNotation}>{entry.notation}</Text>
              <Text style={styles.historyValues} numberOfLines={2}>
                {entry.values.join(' · ')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const content = (
    <View style={[pageStyles.container, styles.root]}>
      {hasDesktopSidebar ? (
        <Text style={pageStyles.title}>Дайсы</Text>
      ) : (
        <MobileScreenHeader title="Дайсы" />
      )}

      <View style={styles.colorBar}>
        <DiceColorPicker
          value={accent}
          disabled={rolling}
          onChange={(hex) => {
            void setAccent(hex);
          }}
        />
      </View>

      <View style={[styles.workspace, compact && styles.workspaceCompact]}>
        {dieRail}

        <View style={styles.trayColumn}>
          <View style={[styles.tray, compact && styles.trayCompact]}>
            <View style={styles.trayInnerRing} />
            <View style={styles.stageFill}>
              {isFocused ? (
                <DiceStage
                  key={accent}
                  ref={stageRef}
                  accent={accent}
                  onReady={() => setStageReady(true)}
                  onDone={handleDone}
                />
              ) : null}
            </View>

            <View style={styles.statusChip}>
              <View style={styles.statusPill}>
                <Text style={styles.statusText} numberOfLines={2}>
                  {!stageReady
                    ? 'Подготовка игрового стола…'
                    : rolling
                      ? 'Идёт бросок…'
                      : notationLabel}
                </Text>
              </View>
            </View>

            {!rolling ? (
              <View style={styles.rollOverlay} pointerEvents="box-none">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Сделать бросок"
                  disabled={!stageReady || parts.length === 0}
                  onPress={handleRoll}
                  style={({ pressed }) => [
                    styles.rollBtn,
                    showLast && { marginBottom: 56 },
                    (!stageReady || parts.length === 0) && styles.rollBtnDisabled,
                    pressed &&
                      stageReady &&
                      parts.length > 0 && { opacity: 0.92, transform: [{ scale: 0.98 }] },
                  ]}>
                  <Text style={styles.rollLabel}>
                    {!stageReady ? '…' : 'Бросок'}
                  </Text>
                  {stageReady ? (
                    <Ionicons name="arrow-forward" size={18} color={colors.onPrimary} />
                  ) : null}
                </Pressable>
              </View>
            ) : null}

            {showLast && outcome ? (
              <View style={styles.lastResult}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Скрыть результат"
                  onPress={() => setShowLast(false)}
                  style={styles.lastResultMain}>
                  <Text style={styles.lastResultSum}>{outcome.sum}</Text>
                  <View style={styles.lastResultMeta}>
                    <Text style={styles.lastResultNotation}>{outcome.notation}</Text>
                    <Text style={styles.lastResultValues} numberOfLines={1}>
                      {outcome.values.join(' · ')}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Повторить бросок"
                  onPress={() => {
                    setShowLast(false);
                    handleRoll();
                  }}
                  style={styles.lastResultDismiss}>
                  <Ionicons name="refresh" size={20} color={colors.primaryLight} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        {historyPanel}
      </View>
    </View>
  );

  return (
    <DieMeshPreviewProvider>
      <ScreenTransition animateOnFocus>{content}</ScreenTransition>
    </DieMeshPreviewProvider>
  );
}
