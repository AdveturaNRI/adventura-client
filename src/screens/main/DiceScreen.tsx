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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  applyDiceKeepMode,
  DICE_CRIT_FAIL_LABEL,
  diceFaceMark,
  diceRollCritLabels,
  diceRollModeLabel,
  keptDiceValue,
  collectD20Values,
  modifierFromOutcome,
  type DiceRollMode,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationSpeedSync,
  loadDiceAnimationSpeed,
  saveDiceAnimationSpeed,
  subscribeDiceAnimationSpeed,
  type DiceAnimationSpeed,
} from '@/utils/dice-animations-storage';
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

const DICE_SPEED_OPTIONS: {
  value: DiceAnimationSpeed;
  icon: keyof typeof Ionicons.glyphMap;
  iconExtra?: keyof typeof Ionicons.glyphMap;
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

type Pool = Record<DieSides, number>;

function poolParts(pool: Pool) {
  return DIE_OPTIONS.filter((option) => pool[option.sides] > 0).map(
    (option) => `${pool[option.sides]}d${option.sides}`,
  );
}

function formatNotationWithModifier(
  parts: string[],
  modifier: number,
  mode: DiceRollMode = 'normal',
) {
  if (mode === 'advantage' || mode === 'disadvantage') {
    const base = '1d20';
    if (modifier === 0) {
      return base;
    }
    return modifier > 0 ? `${base} + ${modifier}` : `${base} − ${Math.abs(modifier)}`;
  }
  if (parts.length === 0) {
    return '';
  }
  const base = parts.join(' + ');
  if (modifier === 0) {
    return base;
  }
  return modifier > 0 ? `${base} + ${modifier}` : `${base} − ${Math.abs(modifier)}`;
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
      flexGrow: 0,
      flexShrink: 0,
    },
    compactScroll: {
      flex: 1,
      minHeight: 0,
    },
    compactScrollContent: {
      gap: 6,
      paddingBottom: Spacing.md,
      flexGrow: 1,
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
      minHeight: 0,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 6,
      flexDirection: 'column',
      alignItems: 'stretch',
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
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      gap: 0,
      rowGap: 4,
      paddingHorizontal: 0,
      width: '100%',
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
      width: '25%',
      minWidth: 0,
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1,
      paddingHorizontal: 1,
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
    dieHitCompact: {
      width: 40,
      height: 40,
      borderRadius: 12,
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
    dieMinusCompact: {
      width: 24,
      height: 18,
      borderRadius: 7,
    },
    dieMinusSpacerCompact: {
      height: 18,
    },
    railDivider: {
      width: 32,
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(132, 185, 255, 0.35)',
      marginVertical: 6,
    },
    railTool: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.12)',
    },
    railToolCompact: {
      width: 40,
      height: 40,
      borderRadius: 12,
      marginTop: 0,
    },
    railToolDisabled: {
      opacity: 0.35,
    },

    trayColumn: {
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      zIndex: 1,
    },
    trayColumnCompact: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 0,
      gap: Spacing.sm,
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
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 160,
      borderRadius: 16,
      borderWidth: 2,
    },
    trayCompactShort: {
      minHeight: 140,
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
    rollBtnCompact: {
      minWidth: 0,
      width: '100%',
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
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
    rollLabelCompact: {
      fontSize: 15,
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
    statusChipCompact: {
      top: 8,
      left: 8,
      right: 8,
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
    statusPillCompact: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primaryLight,
      textAlign: 'center',
    },
    lastResult: {
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
    lastResultOverlay: {
      position: 'absolute',
      bottom: 14,
      left: 14,
      right: 14,
      zIndex: 4,
    },
    lastResultCompact: {
      marginTop: 0,
      backgroundColor: '#101820',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      gap: 8,
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
    lastResultSumCompact: {
      fontSize: 22,
      minWidth: 36,
    },
    lastResultSumCritFail: {
      color: colors.destructive,
    },
    lastResultSumCritSuccess: {
      color: colors.success,
    },
    lastResultMeta: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    lastResultNotation: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primaryLight,
    },
    lastResultCritRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    lastResultCritBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    lastResultCritBadgeFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.18)',
    },
    lastResultCritBadgeSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.18)',
    },
    lastResultCritText: {
      fontSize: 11,
      fontWeight: '700',
    },
    lastResultCritTextFail: {
      color: colors.destructive,
    },
    lastResultCritTextSuccess: {
      color: colors.success,
    },
    lastResultFaces: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    lastResultFace: {
      minWidth: 22,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: 'rgba(21, 122, 254, 0.18)',
      alignItems: 'center',
    },
    lastResultFaceFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.2)',
    },
    lastResultFaceSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.2)',
    },
    lastResultFaceText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#E8EEF8',
    },
    lastResultFaceTextFail: {
      color: '#FFD1CE',
    },
    lastResultFaceTextSuccess: {
      color: '#C8F5D2',
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
      flexGrow: 0,
      flexShrink: 0,
      overflow: 'hidden',
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
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 14,
      maxHeight: 160,
      marginTop: 0,
      padding: 10,
    },
    historyScroll: {
      flexGrow: 0,
    },
    historyScrollCompact: {
      maxHeight: 110,
      flexGrow: 0,
      flexShrink: 0,
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
      gap: 4,
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
    historySumCritFail: {
      color: colors.destructive,
    },
    historySumCritSuccess: {
      color: colors.success,
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
    historyCritRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    historyFaces: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 3,
    },
    historyFace: {
      minWidth: 20,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 5,
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
      alignItems: 'center',
    },
    historyFaceFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.18)',
    },
    historyFaceSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.18)',
    },
    historyFaceKept: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    historyFaceDiscarded: {
      opacity: 0.42,
    },
    historyFaceText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.text,
    },
    historyFaceTextFail: {
      color: colors.destructive,
    },
    historyFaceTextSuccess: {
      color: colors.success,
    },
    colorBar: {
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    colorBarCompact: {
      paddingHorizontal: 0,
      paddingBottom: 0,
      gap: 6,
    },
    controlsStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    controlsStripGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
    },
    modRow: {
      gap: 6,
      paddingHorizontal: 4,
    },
    modLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    modControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
    },
    modBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(21, 122, 254, 0.14)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
    },
    modValue: {
      minWidth: 32,
      textAlign: 'center',
      fontSize: FontSize.label,
      fontWeight: '800',
      color: colors.primary,
    },
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 4,
    },
    modeChip: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeChipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    modeChipText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.1,
    },
    modeChipTextOn: {
      color: colors.onPrimary,
    },
    speedRow: {
      gap: 6,
      paddingHorizontal: 4,
    },
    speedLabel: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    speedSegment: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      gap: 4,
    },
    speedChip: {
      width: 30,
      height: 30,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.28)',
      backgroundColor: 'rgba(21, 122, 254, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    speedChipOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
}

export default function DiceScreen() {
  const pageStyles = useMainScreenStyles();
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasDesktopSidebar = useIsDesktopSidebarVisible();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const stageRef = useRef<DiceStageHandle>(null);
  const { accent, setAccent } = useDiceAccentColor();

  const compact = width < 760;
  const medium = width >= 760 && width < 1100;
  const large = width >= 1100;
  const shortViewport = height < 720;
  const trayHeight = compact
    ? Math.round(Math.min(shortViewport ? 168 : 200, Math.max(150, height * 0.24)))
    : undefined;
  const diePreviewSize = large ? 52 : medium ? 46 : compact ? 28 : 40;

  const [pool, setPool] = useState<Pool>(INITIAL_POOL);
  const [modifier, setModifier] = useState(0);
  const modifierRef = useRef(0);
  modifierRef.current = modifier;
  const [mode, setMode] = useState<DiceRollMode>('normal');
  const modeRef = useRef<DiceRollMode>('normal');
  modeRef.current = mode;
  const [animationSpeed, setAnimationSpeed] = useState<DiceAnimationSpeed>(
    getDiceAnimationSpeedSync,
  );
  const animationSpeedRef = useRef(animationSpeed);
  animationSpeedRef.current = animationSpeed;
  const [stageReady, setStageReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState<DiceRollOutcome | null>(null);
  const [showLast, setShowLast] = useState(false);
  const [history, setHistory] = useState<DiceHistoryEntry[]>([]);
  const [hoveredDie, setHoveredDie] = useState<DieSides | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';

  const keepMode = mode !== 'normal';

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
  const modeLabel = diceRollModeLabel(mode);
  const formulaLabel = parts.length
    ? formatNotationWithModifier(parts, modifier, mode)
    : '';
  const notationLabel = keepMode
    ? modeLabel
      ? modifier === 0
        ? modeLabel
        : `${modeLabel} · ${formulaLabel}`
      : formulaLabel
    : parts.length
      ? formulaLabel
      : 'Выберите кости для броска';
  const totalDice = useMemo(
    () => DIE_OPTIONS.reduce((acc, option) => acc + pool[option.sides], 0),
    [pool],
  );
  const outcomeMode = outcome?.mode ?? 'normal';
  const outcomeModifier = outcome ? modifierFromOutcome(outcome) : 0;
  const outcomeCritLabels = useMemo(
    () => (outcome ? diceRollCritLabels(outcome.groups, outcomeMode, outcomeModifier) : []),
    [outcome, outcomeMode, outcomeModifier],
  );
  const outcomeKept =
    outcomeMode === 'advantage' || outcomeMode === 'disadvantage'
      ? keptDiceValue(collectD20Values(outcome?.groups ?? []), outcomeMode)
      : null;
  const outcomeSingleMark = useMemo(() => {
    if (!outcome) {
      return null;
    }
    if (outcomeKept != null) {
      return diceFaceMark(20, outcomeKept, outcomeModifier);
    }
    if (outcome.groups.length !== 1 || outcome.groups[0]!.values.length !== 1) {
      return null;
    }
    return diceFaceMark(
      outcome.groups[0]!.sides,
      outcome.groups[0]!.values[0]!,
      outcomeModifier,
    );
  }, [outcome, outcomeKept, outcomeModifier]);

  useEffect(() => {
    if (isFocused) {
      void loadDiceAnimationSpeed().then(setAnimationSpeed);
      return subscribeDiceAnimationSpeed(setAnimationSpeed);
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
    if (!stageReady || rolling || animationSpeed === 'off') return;
    const timer = setTimeout(() => {
      if (parts.length === 0) {
        stageRef.current?.preview([]);
      } else {
        stageRef.current?.preview(parts.length === 1 ? parts[0] : parts);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [animationSpeed, parts, rolling, stageReady]);

  const setKeepMode = useCallback((next: DiceRollMode) => {
    setMode((prev) => {
      const resolved = prev === next ? 'normal' : next;
      if (resolved === 'advantage' || resolved === 'disadvantage') {
        setPool({ ...EMPTY_POOL, 20: 2 });
      }
      return resolved;
    });
  }, []);

  const handleAnimationSpeedChange = useCallback((next: DiceAnimationSpeed) => {
    setAnimationSpeed(next);
    void saveDiceAnimationSpeed(next);
  }, []);

  const bump = useCallback(
    (sides: DieSides, delta: number) => {
      if (keepMode) {
        return;
      }
      setPool((prev) => {
        const current = prev[sides];
        const next = current + delta;
        if (next < 0 || next > MAX_PER_DIE) return prev;
        const total =
          DIE_OPTIONS.reduce((acc, option) => acc + prev[option.sides], 0) - current + next;
        if (total > MAX_TOTAL) return prev;
        return { ...prev, [sides]: next };
      });
    },
    [keepMode],
  );

  const clearPool = useCallback(() => {
    setMode('normal');
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

  const handleDone = useCallback(
    (next: DiceRollOutcome) => {
      const mod = modifierRef.current;
      const rollMode = modeRef.current;
      const kept = applyDiceKeepMode(next, rollMode, mod);
      const enriched: DiceRollOutcome = {
        ...kept,
        notation: formatNotationWithModifier(
          kept.groups
            .filter((group) => group.values.length > 0 && group.sides > 0)
            .map((group) => `${group.values.length}d${group.sides}`),
          mod,
          rollMode,
        ) || kept.notation || next.notation,
        mode: rollMode === 'normal' ? undefined : rollMode,
      };
      setOutcome(enriched);
      setRolling(false);
      setShowLast(true);
      pushHistory(enriched);
    },
    [pushHistory],
  );

  const handleRoll = useCallback(async () => {
    if (rolling || parts.length === 0) return;
    const speed = animationSpeedRef.current;
    if (speed === 'off') {
      setRolling(true);
      setShowLast(false);
      const groups = DIE_OPTIONS.filter((option) => pool[option.sides] > 0).map((option) => {
        const values = Array.from(
          { length: pool[option.sides] },
          () => Math.floor(Math.random() * option.sides) + 1,
        );
        return {
          sides: option.sides as number,
          values,
          sum: values.reduce((a, b) => a + b, 0),
        };
      });
      const values = groups.flatMap((g) => g.values);
      handleDone({
        values,
        sum: values.reduce((a, b) => a + b, 0),
        notation: parts.join(' + '),
        groups,
      });
      return;
    }
    if (!stageReady) return;
    setRolling(true);
    setShowLast(false);
    try {
      await stageRef.current?.roll(parts.length === 1 ? parts[0] : parts);
    } catch {
      setRolling(false);
    }
  }, [handleDone, parts, pool, rolling, stageReady]);

  const dieCells = DIE_OPTIONS.map((option) => {
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
          (rolling || keepMode) && { opacity: 0.55 },
          showTooltip && { zIndex: 30 },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${option.fullName}. Добавить, сейчас ${count}`}
          disabled={rolling || keepMode || !canPlus}
          onPress={() => bump(option.sides, 1)}
          onHoverIn={() => showDieTooltip(option.sides)}
          onHoverOut={hideDieTooltip}
          style={({ pressed }) => [
            styles.dieHit,
            compact && styles.dieHitCompact,
            (medium || large) && styles.dieHitLg,
            active && styles.dieHitActive,
            pressed && canPlus && !keepMode && { opacity: 0.88 },
          ]}>
          {active ? (
            <View style={styles.dieBadge}>
              <Text style={styles.dieBadgeText}>{count}</Text>
            </View>
          ) : null}
          <DieMeshPreview
            sides={option.sides}
            size={compact ? diePreviewSize : diePreviewSize}
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
            disabled={rolling || keepMode}
            onPress={() => bump(option.sides, -1)}
            style={({ pressed }) => [
              styles.dieMinus,
              compact && styles.dieMinusCompact,
              pressed && !keepMode && { opacity: 0.85 },
            ]}>
            <Ionicons name="remove" size={14} color={colors.primaryLight} />
          </Pressable>
        ) : compact ? (
          <View style={styles.dieMinusSpacerCompact} />
        ) : null}
      </View>
    );
  });

  const clearTool = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Сбросить набор"
      disabled={rolling || totalDice === 0}
      onPress={clearPool}
      style={({ pressed }) => [
        styles.railTool,
        compact && styles.railToolCompact,
        (rolling || totalDice === 0) && styles.railToolDisabled,
        pressed && totalDice > 0 && { opacity: 0.85 },
      ]}>
      <Ionicons name="trash-outline" size={18} color={colors.primaryLight} />
    </Pressable>
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
      {compact ? (
        <View style={[styles.railScrollContent, styles.railScrollContentCompact]}>
          {dieCells}
          <View style={[styles.dieSection, styles.dieSectionCompact]}>
            {clearTool}
            <Text style={[styles.dieLabel, styles.dieLabelMuted]} numberOfLines={1}>
              сброс
            </Text>
            <View style={styles.dieMinusSpacerCompact} />
          </View>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.railScrollContent}
          style={styles.railScroll}>
          {dieCells}
          <View style={styles.railDivider} />
          {clearTool}
        </ScrollView>
      )}
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
      <ScrollView
        style={[styles.historyScroll, compact ? styles.historyScrollCompact : null]}
        contentContainerStyle={compact ? { paddingBottom: 2 } : undefined}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>
            Здесь появятся результаты: сумма, нотация и значения по костям.
          </Text>
        ) : (
          history.map((entry) => {
            const entryMode = entry.mode ?? 'normal';
            const entryMod = modifierFromOutcome(entry);
            const critLabels = diceRollCritLabels(entry.groups, entryMode, entryMod);
            const kept =
              entryMode === 'advantage' || entryMode === 'disadvantage'
                ? keptDiceValue(collectD20Values(entry.groups), entryMode)
                : null;
            const singleMark =
              kept != null
                ? diceFaceMark(20, kept, entryMod)
                : entry.groups.length === 1 && entry.groups[0]?.values.length === 1
                  ? diceFaceMark(entry.groups[0].sides, entry.groups[0].values[0]!, entryMod)
                  : null;
            return (
              <View key={entry.id} style={styles.historyItem}>
                <View style={styles.historyItemTop}>
                  <Text
                    style={[
                      styles.historySum,
                      singleMark === 'crit_fail' ? styles.historySumCritFail : null,
                      singleMark === 'crit_success' ? styles.historySumCritSuccess : null,
                    ]}>
                    {entry.sum}
                  </Text>
                  <Text style={styles.historyTime}>{formatTime(entry.at)}</Text>
                </View>
                <Text style={styles.historyNotation}>
                  {entryMode === 'advantage' || entryMode === 'disadvantage'
                    ? `${diceRollModeLabel(entryMode)} · ${entry.notation}`
                    : entry.notation}
                </Text>
                {critLabels.length > 0 ? (
                  <View style={styles.historyCritRow}>
                    {critLabels.map((label) => {
                      const isFail = label === DICE_CRIT_FAIL_LABEL;
                      return (
                        <View
                          key={label}
                          style={[
                            styles.lastResultCritBadge,
                            isFail
                              ? styles.lastResultCritBadgeFail
                              : styles.lastResultCritBadgeSuccess,
                          ]}>
                          <Text
                            style={[
                              styles.lastResultCritText,
                              isFail
                                ? styles.lastResultCritTextFail
                                : styles.lastResultCritTextSuccess,
                            ]}>
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.historyFaces}>
                  {entry.groups.flatMap((group, groupIndex) => {
                    const isKeepGroup =
                      (entryMode === 'advantage' || entryMode === 'disadvantage') &&
                      group.sides === 20 &&
                      kept != null;
                    const keptIndex =
                      isKeepGroup && kept != null ? group.values.indexOf(kept) : -1;
                    return group.values.map((value, index) => {
                      const keptHighlight = isKeepGroup && index === keptIndex;
                      const discardedHighlight = isKeepGroup && index !== keptIndex;
                      const showCrit = !isKeepGroup || keptHighlight;
                      const mark = diceFaceMark(group.sides, value, entryMod);
                      return (
                        <View
                          key={`${entry.id}-g${groupIndex}-${index}`}
                          style={[
                            styles.historyFace,
                            mark === 'crit_fail' && showCrit ? styles.historyFaceFail : null,
                            mark === 'crit_success' && showCrit
                              ? styles.historyFaceSuccess
                              : null,
                            keptHighlight ? styles.historyFaceKept : null,
                            discardedHighlight ? styles.historyFaceDiscarded : null,
                          ]}>
                          <Text
                            style={[
                              styles.historyFaceText,
                              mark === 'crit_fail' && showCrit
                                ? styles.historyFaceTextFail
                                : null,
                              mark === 'crit_success' && showCrit
                                ? styles.historyFaceTextSuccess
                                : null,
                            ]}>
                            {value}
                          </Text>
                        </View>
                      );
                    });
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const lastResultCard =
    showLast && outcome ? (
      <View
        style={[
          styles.lastResult,
          compact ? styles.lastResultCompact : styles.lastResultOverlay,
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Скрыть результат"
          onPress={() => setShowLast(false)}
          style={styles.lastResultMain}>
          <Text
            style={[
              styles.lastResultSum,
              compact ? styles.lastResultSumCompact : null,
              outcomeSingleMark === 'crit_fail' ? styles.lastResultSumCritFail : null,
              outcomeSingleMark === 'crit_success'
                ? styles.lastResultSumCritSuccess
                : null,
            ]}>
            {outcome.sum}
          </Text>
          <View style={styles.lastResultMeta}>
            <Text style={styles.lastResultNotation}>
              {outcomeMode === 'advantage' || outcomeMode === 'disadvantage'
                ? `${diceRollModeLabel(outcomeMode)} · ${outcome.notation}`
                : outcome.notation}
            </Text>
            {outcomeCritLabels.length > 0 ? (
              <View style={styles.lastResultCritRow}>
                {outcomeCritLabels.map((label) => {
                  const isFail = label === DICE_CRIT_FAIL_LABEL;
                  return (
                    <View
                      key={label}
                      style={[
                        styles.lastResultCritBadge,
                        isFail
                          ? styles.lastResultCritBadgeFail
                          : styles.lastResultCritBadgeSuccess,
                      ]}>
                      <Text
                        style={[
                          styles.lastResultCritText,
                          isFail
                            ? styles.lastResultCritTextFail
                            : styles.lastResultCritTextSuccess,
                        ]}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.lastResultFaces}>
              {outcome.groups.flatMap((group, groupIndex) => {
                const isKeepGroup =
                  (outcomeMode === 'advantage' || outcomeMode === 'disadvantage') &&
                  group.sides === 20 &&
                  outcomeKept != null;
                const keptIndex =
                  isKeepGroup && outcomeKept != null
                    ? group.values.indexOf(outcomeKept)
                    : -1;
                return group.values.map((value, index) => {
                  const mark = diceFaceMark(group.sides, value, outcomeModifier);
                  const keptHighlight = isKeepGroup && index === keptIndex;
                  const discardedHighlight = isKeepGroup && index !== keptIndex;
                  const showCrit = !isKeepGroup || keptHighlight;
                  return (
                    <View
                      key={`last-g${groupIndex}-${index}`}
                      style={[
                        styles.lastResultFace,
                        mark === 'crit_fail' && showCrit
                          ? styles.lastResultFaceFail
                          : null,
                        mark === 'crit_success' && showCrit
                          ? styles.lastResultFaceSuccess
                          : null,
                        discardedHighlight ? { opacity: 0.42 } : null,
                        keptHighlight
                          ? {
                              borderWidth: 1.5,
                              borderColor: colors.primary,
                            }
                          : null,
                      ]}>
                      <Text
                        style={[
                          styles.lastResultFaceText,
                          mark === 'crit_fail' && showCrit
                            ? styles.lastResultFaceTextFail
                            : null,
                          mark === 'crit_success' && showCrit
                            ? styles.lastResultFaceTextSuccess
                            : null,
                        ]}>
                        {value}
                      </Text>
                    </View>
                  );
                });
              })}
            </View>
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
    ) : null;

  const modControls = (
    <View style={styles.modControls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Уменьшить модификатор"
        disabled={rolling}
        onPress={() => setModifier((value) => Math.max(-99, value - 1))}
        style={({ pressed }) => [styles.modBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name="remove" size={16} color={colors.primary} />
      </Pressable>
      <Text style={styles.modValue}>
        {modifier > 0 ? `+${modifier}` : String(modifier)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Увеличить модификатор"
        disabled={rolling}
        onPress={() => setModifier((value) => Math.min(99, value + 1))}
        style={({ pressed }) => [styles.modBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name="add" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );

  const modeChips = (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'advantage' }}
        disabled={rolling}
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
        disabled={rolling}
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
    </>
  );

  const speedChips = (
    <View style={styles.speedSegment}>
      {DICE_SPEED_OPTIONS.map((option) => {
        const selected = animationSpeed === option.value;
        const iconColor = selected ? colors.onPrimary : colors.primary;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ selected }}
            disabled={rolling}
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
  );

  const colorBar = (
    <View style={[styles.colorBar, compact && styles.colorBarCompact]}>
      <DiceColorPicker
        value={accent}
        compact={compact}
        disabled={rolling}
        onChange={(hex) => {
          void setAccent(hex);
        }}
      />
      {compact ? (
        <View style={styles.controlsStrip}>
          <View style={styles.controlsStripGroup}>{modControls}</View>
          <View style={styles.controlsStripGroup}>{modeChips}</View>
          <View style={styles.controlsStripGroup}>{speedChips}</View>
        </View>
      ) : (
        <>
          <View style={styles.modRow}>
            <Text style={styles.modLabel}>Модификатор</Text>
            {modControls}
          </View>
          <View style={styles.modeRow}>{modeChips}</View>
          <View style={styles.speedRow}>
            <Text style={styles.speedLabel}>Анимация</Text>
            {speedChips}
          </View>
        </>
      )}
    </View>
  );

  const rollButton = !rolling ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Сделать бросок"
      disabled={parts.length === 0 || (animationSpeed !== 'off' && !stageReady)}
      onPress={handleRoll}
      style={({ pressed }) => [
        styles.rollBtn,
        compact && styles.rollBtnCompact,
        !compact && showLast ? { marginBottom: 56 } : null,
        (parts.length === 0 || (animationSpeed !== 'off' && !stageReady)) &&
          styles.rollBtnDisabled,
        pressed &&
          (animationSpeed === 'off' || stageReady) &&
          parts.length > 0 && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}>
      <Text style={[styles.rollLabel, compact && styles.rollLabelCompact]}>
        {animationSpeed !== 'off' && !stageReady ? '…' : 'Бросок'}
      </Text>
      {animationSpeed === 'off' || stageReady ? (
        <Ionicons name="arrow-forward" size={compact ? 16 : 18} color={colors.onPrimary} />
      ) : null}
    </Pressable>
  ) : null;

  const trayBlock = (
    <View style={[styles.trayColumn, compact && styles.trayColumnCompact]}>
      <View
        style={[
          styles.tray,
          compact && styles.trayCompact,
          compact && shortViewport && styles.trayCompactShort,
          trayHeight != null ? { height: trayHeight, minHeight: trayHeight } : null,
        ]}>
        <View style={styles.trayInnerRing} />
        <View style={styles.stageFill}>
          {isFocused ? (
            <DiceStage
              ref={stageRef}
              accent={accent}
              animationSpeed={animationSpeed === 'off' ? 'normal' : animationSpeed}
              onReady={() => setStageReady(true)}
              onDone={handleDone}
            />
          ) : null}
        </View>

        <View style={[styles.statusChip, compact && styles.statusChipCompact]}>
          <View style={[styles.statusPill, compact && styles.statusPillCompact]}>
            <Text style={styles.statusText} numberOfLines={1}>
              {!stageReady
                ? 'Подготовка стола…'
                : rolling
                  ? 'Идёт бросок…'
                  : notationLabel}
            </Text>
          </View>
        </View>

        {!compact && rollButton ? (
          <View style={styles.rollOverlay} pointerEvents="box-none">
            {rollButton}
          </View>
        ) : null}

        {!compact ? lastResultCard : null}
      </View>
      {compact ? rollButton : null}
      {compact ? lastResultCard : null}
    </View>
  );

  const workspaceBody = (
    <>
      {dieRail}
      {trayBlock}
      {historyPanel}
    </>
  );

  const content = (
    <View
      style={[
        pageStyles.container,
        styles.root,
        compact ? { paddingHorizontal: Spacing.sm, gap: 6 } : null,
      ]}>
      {hasDesktopSidebar ? (
        <Text style={pageStyles.title}>Дайсы</Text>
      ) : (
        <MobileScreenHeader title="Дайсы" />
      )}

      {compact ? (
        <ScrollView
          style={styles.compactScroll}
          contentContainerStyle={[
            styles.compactScrollContent,
            { paddingBottom: Math.max(insets.bottom, Spacing.md) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled>
          {colorBar}
          <View style={[styles.workspace, styles.workspaceCompact]}>{workspaceBody}</View>
        </ScrollView>
      ) : (
        <>
          {colorBar}
          <View style={styles.workspace}>{workspaceBody}</View>
        </>
      )}
    </View>
  );

  return (
    <DieMeshPreviewProvider>
      <ScreenTransition animateOnFocus>{content}</ScreenTransition>
    </DieMeshPreviewProvider>
  );
}
