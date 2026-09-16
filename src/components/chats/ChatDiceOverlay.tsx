import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import type { DiceRollOutcome } from '@/components/dice/dice-stage.types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  diceInputsToNotation,
  formatDiceFormula,
  payloadToForcedNotation,
  type DiceRollDieInput,
  type DiceRollPayload,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationsEnabledSync,
  loadDiceAnimationsEnabled,
} from '@/utils/dice-animations-storage';
import { coerceDiceAccent } from '@/utils/dice-color-storage';

export type ChatDiceOverlayRequest = {
  messageId: string;
  payload: DiceRollPayload;
  senderNickname: string;
};

/** Свой бросок: сначала 3D на фронте, потом эти цифры уходят на API. */
export type ChatDiceLocalRollRequest = {
  token: number;
  dice: DiceRollDieInput[];
  modifier: number;
  color: string;
  senderNickname: string;
};

type ChatDiceOverlayProps = {
  request: ChatDiceOverlayRequest | null;
  localRoll?: ChatDiceLocalRollRequest | null;
  onLocalRollComplete?: (outcome: DiceRollOutcome | null) => void;
  /** Показать сообщение в ленте (те же цифры, что на карточке). */
  onReveal: (messageId: string) => void;
  /** Запустить следующий бросок из очереди. */
  onAdvance: () => void;
  warm?: boolean;
};

type ResultSnapshot = {
  messageId: string;
  senderNickname: string;
  formula: string;
  faces: number[];
  sum: number;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 40,
      pointerEvents: 'none',
    },
    rootCollapsed: {
      opacity: 0,
      width: 1,
      height: 1,
      top: 0,
      left: 0,
      right: undefined,
      bottom: undefined,
      overflow: 'hidden',
    },
    stage: {
      ...StyleSheet.absoluteFill,
    },
    throwerBanner: {
      position: 'absolute',
      left: Spacing.md,
      right: Spacing.md,
      alignItems: 'center',
      zIndex: 2,
    },
    throwerChip: {
      maxWidth: '100%',
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: 'rgba(11, 18, 32, 0.82)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.4)',
    },
    throwerLabel: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.62)',
      textAlign: 'center',
    },
    throwerName: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    resultWrap: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    resultCard: {
      minWidth: 180,
      maxWidth: 320,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      borderRadius: 20,
      backgroundColor: 'rgba(11, 18, 32, 0.88)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.45)',
      alignItems: 'center',
      gap: 8,
    },
    resultWho: {
      fontSize: FontSize.caption,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.72)',
    },
    resultFormula: {
      fontSize: FontSize.label,
      fontWeight: '700',
      color: colors.primaryLight,
    },
    resultFaces: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
      maxWidth: 260,
    },
    resultFace: {
      minWidth: 28,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      backgroundColor: 'rgba(21, 122, 254, 0.22)',
      alignItems: 'center',
    },
    resultFaceText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    resultSum: {
      fontSize: 48,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -1,
    },
  });
}

function documentIsVisible() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return AppState.currentState === 'active';
  }
  return document.visibilityState === 'visible';
}

function canAnimateIncoming(
  request: ChatDiceOverlayRequest,
  animationsEnabled: boolean,
  isFocused: boolean,
) {
  return (
    animationsEnabled &&
    isFocused &&
    documentIsVisible() &&
    !request.payload.redacted &&
    request.payload.sum != null
  );
}

function normalizeOutcomeGroups(
  outcome: DiceRollOutcome,
  dice: DiceRollDieInput[],
): DiceRollOutcome {
  const expected = [...dice].sort((a, b) => a.sides - b.sides);
  const bySides = new Map<number, number[]>();
  for (const group of outcome.groups) {
    const rawSides = group.sides as number | string;
    const sides =
      typeof rawSides === 'number'
        ? rawSides
        : Number(String(rawSides).replace(/^d/i, '')) || 0;
    const prev = bySides.get(sides) ?? [];
    bySides.set(sides, [...prev, ...group.values]);
  }

  let flat = [...outcome.values];
  const groups = expected.map((die) => {
    const fromMap = bySides.get(die.sides);
    let values: number[];
    if (fromMap && fromMap.length >= die.qty) {
      values = fromMap.slice(0, die.qty);
    } else {
      values = flat.splice(0, die.qty);
    }
    return {
      sides: die.sides,
      values,
      sum: values.reduce((a, b) => a + b, 0),
    };
  });
  const values = groups.flatMap((g) => g.values);
  return {
    values,
    sum: values.reduce((a, b) => a + b, 0),
    notation: outcome.notation,
    groups,
  };
}

/**
 * Свой бросок: 3D на фронте (threejs) → цифры на API.
 * Чужой: forced `@values` — у всех падают те же грани.
 */
export function ChatDiceOverlay({
  request,
  localRoll = null,
  onLocalRollComplete,
  onReveal,
  onAdvance,
  warm = false,
}: ChatDiceOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const stageRef = useRef<DiceStageHandle>(null);
  const onRevealRef = useRef(onReveal);
  const onAdvanceRef = useRef(onAdvance);
  const onLocalCompleteRef = useRef(onLocalRollComplete);
  onRevealRef.current = onReveal;
  onAdvanceRef.current = onAdvance;
  onLocalCompleteRef.current = onLocalRollComplete;
  const { accent: localAccent } = useDiceAccentColor();

  const activeAccent = coerceDiceAccent(
    localRoll?.color ?? request?.payload.color ?? localAccent,
  );

  const [stageReady, setStageReady] = useState(false);
  const [result, setResult] = useState<ResultSnapshot | null>(null);
  const [animationsEnabled, setAnimationsEnabled] = useState(getDiceAnimationsEnabledSync);
  const [engineMounted, setEngineMounted] = useState(false);

  const handleStageReady = useRef(() => {
    setStageReady(true);
  }).current;

  useEffect(() => {
    void loadDiceAnimationsEnabled().then(setAnimationsEnabled);
  }, [localRoll?.token, request?.messageId]);

  useEffect(() => {
    if (warm || request || localRoll) {
      setEngineMounted(true);
    }
  }, [warm, request, localRoll]);

  // --- Свой бросок: фронт = источник истины (строго один roll на token) ---
  const animationsEnabledRef = useRef(animationsEnabled);
  animationsEnabledRef.current = animationsEnabled;
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;
  const startedLocalTokensRef = useRef(new Set<number>());

  useEffect(() => {
    if (!localRoll) {
      return;
    }

    const active = localRoll;

    if (startedLocalTokensRef.current.has(active.token)) {
      return;
    }

    const animationsOn = animationsEnabledRef.current;
    const focused = isFocusedRef.current;

    let settled = false;
    const finishOnce = (outcome: DiceRollOutcome | null) => {
      if (settled) {
        return;
      }
      settled = true;
      onLocalCompleteRef.current?.(outcome);
    };

    const clientFallbackOutcome = (): DiceRollOutcome => {
      const expected = [...active.dice].sort((a, b) => a.sides - b.sides);
      const groups = expected.map((die) => {
        const values = Array.from(
          { length: die.qty },
          () => Math.floor(Math.random() * die.sides) + 1,
        );
        return {
          sides: die.sides,
          values,
          sum: values.reduce((a, b) => a + b, 0),
        };
      });
      const values = groups.flatMap((g) => g.values);
      return {
        values,
        sum: values.reduce((a, b) => a + b, 0) + active.modifier,
        notation: formatDiceFormula(active.dice, active.modifier),
        groups,
      };
    };

    if (!animationsOn || !focused || !documentIsVisible()) {
      startedLocalTokensRef.current.add(active.token);
      finishOnce(clientFallbackOutcome());
      return;
    }

    if (!stageReady) {
      const readyTimeout = setTimeout(() => {
        if (startedLocalTokensRef.current.has(active.token)) {
          return;
        }
        startedLocalTokensRef.current.add(active.token);
        finishOnce(clientFallbackOutcome());
      }, 8000);
      return () => {
        clearTimeout(readyTimeout);
      };
    }

    startedLocalTokensRef.current.add(active.token);
    const notation = diceInputsToNotation(active.dice);
    const formula = formatDiceFormula(active.dice, active.modifier);

    void (async () => {
      let done: DiceRollOutcome | null = null;
      try {
        const raw = await stageRef.current?.roll(notation);
        if (!raw) {
          finishOnce(clientFallbackOutcome());
          return;
        }
        done = normalizeOutcomeGroups(raw, active.dice);
        done = {
          ...done,
          sum: done.values.reduce((a, b) => a + b, 0) + active.modifier,
          notation: formula,
        };
        // Куб уже на нужных гранях — карточка = тот же outcome.
        setResult({
          messageId: `local-${active.token}`,
          senderNickname: active.senderNickname,
          formula,
          faces: done.values,
          sum: done.sum,
        });
        await new Promise((resolve) => setTimeout(resolve, 1100));
      } catch {
        done = clientFallbackOutcome();
      } finally {
        stageRef.current?.clear();
        setResult(null);
        finishOnce(done ?? clientFallbackOutcome());
      }
    })();
  }, [localRoll, stageReady]);

  // --- Чужой / очередь: forced `@` — те же грани, что у отправителя ---
  useEffect(() => {
    if (localRoll || !request) {
      if (!localRoll && !request) {
        setResult(null);
        if (stageReady) {
          stageRef.current?.clear();
        }
      }
      return;
    }

    if (!canAnimateIncoming(request, animationsEnabled, isFocused)) {
      onRevealRef.current(request.messageId);
      onAdvanceRef.current();
      return;
    }

    if (!stageReady) {
      let cancelled = false;
      const readyTimeout = setTimeout(() => {
        if (!cancelled) {
          onRevealRef.current(request.messageId);
          onAdvanceRef.current();
        }
      }, 8000);
      return () => {
        cancelled = true;
        clearTimeout(readyTimeout);
      };
    }

    let cancelled = false;
    const active = request;
    const notation = payloadToForcedNotation(active.payload);
    const faces = active.payload.groups.flatMap((g) => g.values);
    const sum = active.payload.sum;

    void (async () => {
      let revealed = false;
      try {
        await stageRef.current?.roll(notation);
        if (cancelled || sum == null) {
          return;
        }
        // Грани уже forced под payload — куб и карточка совпадают.
        onRevealRef.current(active.messageId);
        revealed = true;
        setResult({
          messageId: active.messageId,
          senderNickname: active.senderNickname,
          formula: active.payload.formula,
          faces,
          sum,
        });
        await new Promise((resolve) => setTimeout(resolve, 1100));
      } catch {
        // fall through
      } finally {
        stageRef.current?.clear();
        setResult(null);
        if (!revealed) {
          onRevealRef.current(active.messageId);
        }
        if (!cancelled) {
          onAdvanceRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [animationsEnabled, isFocused, localRoll, request, stageReady]);

  const visible =
    Boolean(localRoll) ||
    (Boolean(request) &&
      animationsEnabled &&
      isFocused &&
      Boolean(request && !request.payload.redacted && request.payload.sum != null));

  const throwerNickname =
    localRoll?.senderNickname ?? (visible ? request?.senderNickname : null) ?? null;
  const throwerFormula = localRoll
    ? formatDiceFormula(localRoll.dice, localRoll.modifier)
    : visible
      ? request?.payload.formula
      : null;

  if (!engineMounted && !visible && !warm) {
    return null;
  }

  return (
    <View
      style={[styles.root, !visible ? styles.rootCollapsed : null]}
      pointerEvents="none"
      collapsable={false}>
      <View style={styles.stage} pointerEvents="none">
        <DiceStage
          ref={stageRef}
          accent={activeAccent}
          transparent
          onReady={handleStageReady}
        />
      </View>
      {visible && throwerNickname && !result ? (
        <View
          style={[styles.throwerBanner, { top: Math.max(insets.top, Spacing.md) + Spacing.sm }]}
          pointerEvents="none">
          <View style={styles.throwerChip}>
            <Text style={styles.throwerLabel}>Бросает</Text>
            <Text style={styles.throwerName} numberOfLines={1}>
              {throwerNickname}
            </Text>
            {throwerFormula ? (
              <Text style={styles.resultFormula}>{throwerFormula}</Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {result ? (
        <View style={styles.resultWrap} pointerEvents="none">
          <View style={styles.resultCard}>
            <Text style={styles.resultWho}>{result.senderNickname}</Text>
            <Text style={styles.resultFormula}>{result.formula}</Text>
            {result.faces.length > 0 ? (
              <View style={styles.resultFaces}>
                {result.faces.map((value, index) => (
                  <View key={`${index}-${value}`} style={styles.resultFace}>
                    <Text style={styles.resultFaceText}>{value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={styles.resultSum}>{result.sum}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
