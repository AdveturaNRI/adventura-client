import { useIsFocused } from 'expo-router';
import { createElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiceCritBurst } from '@/components/rewards/DiceCritBurst';
import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import { isDiceSkinId, skinAccent, type DiceSkinId } from '@/data/rewards/catalog';
import type { DiceRollOutcome } from '@/components/dice/dice-stage.types';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import {
  getVoiceCallOwnsDice,
  subscribeVoiceCallOwnsDice,
} from '@/context/voice-call-dice-gate';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  applyDiceKeepMode,
  CHAT_DICE_SKINS_ENABLED,
  DICE_CRIT_FAIL_LABEL,
  DICE_CRIT_SUCCESS_LABEL,
  diceFaceMark,
  diceRollCritLabels,
  formatDiceFormula,
  payloadToStageNotation,
  type DiceRollDieInput,
  type DiceRollMode,
  type DiceRollPayload,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationSpeedSync,
  loadDiceAnimationSpeed,
  subscribeDiceAnimationSpeed,
  type DiceAnimationSpeed,
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
  mode?: DiceRollMode;
  skin?: string;
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
  /** Call overlay sits outside the focused route — still play 3D. */
  forceActive?: boolean;
};

type ResultSnapshot = {
  messageId: string;
  senderNickname: string;
  formula: string;
  faces: { sides: number; value: number }[];
  sum: number;
  modifier: number;
  critLabels: string[];
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      // Portal уже `position:fixed` на body. Здесь absolute — иначе при
      // keepStageHot сцена остаётся на вьюпорте, хотя портал уехал за экран.
      ...(Platform.OS === 'web'
        ? ({
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
          } as const)
        : null),
      zIndex: 60,
      elevation: 60,
      pointerEvents: 'none',
    },
    // Не visibility:hidden — WebGL на iOS от этого дохнет.
    // opacity:0 + zIndex:-1: тачи в чат, сцена тёплая на полном размере.
    rootCollapsed: {
      opacity: 0,
      zIndex: -1,
      elevation: 0,
    },
    rootActive: {
      opacity: 1,
      zIndex: 10000,
      elevation: 10000,
    },
    stage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
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
    resultFaceCritFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.28)',
    },
    resultFaceCritSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.28)',
    },
    resultFaceText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    resultFaceTextCritFail: {
      color: '#FFD1CE',
    },
    resultFaceTextCritSuccess: {
      color: '#C8F5D2',
    },
    resultCritRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
    },
    resultCritBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    resultCritBadgeFail: {
      backgroundColor: 'rgba(255, 59, 48, 0.22)',
    },
    resultCritBadgeSuccess: {
      backgroundColor: 'rgba(52, 199, 89, 0.22)',
    },
    resultCritBadgeText: {
      fontSize: FontSize.caption,
      fontWeight: '700',
    },
    resultCritBadgeTextFail: {
      color: '#FFD1CE',
    },
    resultCritBadgeTextSuccess: {
      color: '#C8F5D2',
    },
    resultSum: {
      fontSize: 48,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -1,
    },
    resultSumCritFail: {
      color: '#FF8A84',
    },
    resultSumCritSuccess: {
      color: '#7DDEA0',
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
  animationSpeed: DiceAnimationSpeed,
  isFocused: boolean,
) {
  return (
    animationSpeed !== 'off' &&
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
  forceActive = false,
}: ChatDiceOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const routeFocused = useIsFocused();
  // During a voice call the call UI owns dice (outside Modal). Chat's stage must
  // stay cold — two Babylon iframes white-screen the tab (same class of bug as
  // WebGL under ScreenTransition).
  const [callOwnsDice, setCallOwnsDice] = useState(getVoiceCallOwnsDice);
  useEffect(() => subscribeVoiceCallOwnsDice(() => setCallOwnsDice(getVoiceCallOwnsDice())), []);
  const isFocused = forceActive || (routeFocused && !callOwnsDice);
  const stageRef = useRef<DiceStageHandle>(null);
  const onRevealRef = useRef(onReveal);
  const onAdvanceRef = useRef(onAdvance);
  const onLocalCompleteRef = useRef(onLocalRollComplete);
  onRevealRef.current = onReveal;
  onAdvanceRef.current = onAdvance;
  onLocalCompleteRef.current = onLocalRollComplete;
  const { accent: localAccent } = useDiceAccentColor();

  const activeSkin: DiceSkinId =
    CHAT_DICE_SKINS_ENABLED && isDiceSkinId(localRoll?.skin ?? request?.payload.skin)
      ? ((localRoll?.skin ?? request?.payload.skin) as DiceSkinId)
      : 'standard';

  const activeAccent = coerceDiceAccent(
    activeSkin !== 'standard'
      ? skinAccent(activeSkin)
      : localRoll?.color ?? request?.payload.color ?? localAccent,
  );

  const [stageReady, setStageReady] = useState(false);
  const [result, setResult] = useState<ResultSnapshot | null>(null);
  const [animationSpeed, setAnimationSpeed] = useState<DiceAnimationSpeed>(
    getDiceAnimationSpeedSync,
  );
  const [engineMounted, setEngineMounted] = useState(false);

  const handleStageReady = useRef(() => {
    setStageReady(true);
  }).current;

  useEffect(() => {
    void loadDiceAnimationSpeed().then(setAnimationSpeed);
    return subscribeDiceAnimationSpeed(setAnimationSpeed);
  }, []);

  useEffect(() => {
    // Держим Babylon тёплым, пока чат в фокусе / открыт поповер / идёт бросок.
    // Иначе каждый «Бросить» заново грузит iframe (1–3 с паузы на телефоне).
    if (localRoll || request || warm || isFocused) {
      setEngineMounted(true);
      return;
    }
    setEngineMounted(false);
    setStageReady(false);
  }, [isFocused, localRoll, request, warm]);

  // --- Свой бросок: фронт = источник истины (строго один roll на token) ---
  const animationSpeedRef = useRef(animationSpeed);
  animationSpeedRef.current = animationSpeed;
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

    // Актуальная скорость из storage — не ждём async state после смены в поповере.
    const speed = getDiceAnimationSpeedSync();
    animationSpeedRef.current = speed;
    if (speed !== animationSpeed) {
      setAnimationSpeed(speed);
    }
    const animationsOn = speed !== 'off';
    const focused = isFocusedRef.current;
    const resultHoldMs = speed === 'fast' ? 500 : 1100;
    const rollTimeoutMs = speed === 'fast' ? 6000 : 12000;

    let settled = false;
    let cancelled = false;
    const finishOnce = (outcome: DiceRollOutcome | null) => {
      if (settled || cancelled) {
        return;
      }
      settled = true;
      onLocalCompleteRef.current?.(outcome);
    };

    const rollMode = active.mode ?? 'normal';

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
      return applyDiceKeepMode(
        {
          values,
          sum: values.reduce((a, b) => a + b, 0),
          notation: formatDiceFormula(active.dice, active.modifier, rollMode),
          groups,
        },
        rollMode,
        active.modifier,
      );
    };

    if (!animationsOn || !focused || !documentIsVisible()) {
      startedLocalTokensRef.current.add(active.token);
      finishOnce(clientFallbackOutcome());
      return;
    }

    if (!stageReady) {
      const readyTimeout = setTimeout(() => {
        if (cancelled || startedLocalTokensRef.current.has(active.token)) {
          return;
        }
        startedLocalTokensRef.current.add(active.token);
        finishOnce(clientFallbackOutcome());
      }, 8000);
      return () => {
        cancelled = true;
        clearTimeout(readyTimeout);
      };
    }

    startedLocalTokensRef.current.add(active.token);
    const notationParts = [...active.dice]
      .filter((die) => die.qty > 0)
      .sort((a, b) => a.sides - b.sides)
      .map((die) => `${die.qty}d${die.sides}`);
    const notation =
      notationParts.length === 0
        ? '1d20'
        : notationParts.length === 1
          ? notationParts[0]
          : notationParts;
    const formula = formatDiceFormula(active.dice, active.modifier, rollMode);

    void (async () => {
      let done: DiceRollOutcome | null = null;
      try {
        // Дождаться layout после opacity:0 → visible, иначе resize видит старый размер.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        if (cancelled) {
          return;
        }
        stageRef.current?.resize();
        const rollPromise =
          stageRef.current?.roll(notation) ?? Promise.resolve<DiceRollOutcome | null>(null);
        const raw = await Promise.race([
          // Таймаут/clear не должны давать unhandled rejection и второй finishOnce.
          rollPromise.catch(() => null),
          new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), rollTimeoutMs);
          }),
        ]);
        if (cancelled) {
          return;
        }
        if (!raw) {
          done = clientFallbackOutcome();
        } else {
          done = applyDiceKeepMode(
            normalizeOutcomeGroups(raw, active.dice),
            rollMode,
            active.modifier,
          );
          // Куб уже на нужных гранях — карточка = тот же outcome.
          const faceRows = done.groups.flatMap((group) =>
            group.values.map((value) => ({ sides: group.sides, value })),
          );
          setResult({
            messageId: `local-${active.token}`,
            senderNickname: active.senderNickname,
            formula: done.notation || formula,
            faces: faceRows,
            sum: done.sum,
            modifier: active.modifier,
            critLabels: diceRollCritLabels(done.groups, rollMode, active.modifier),
          });
          await new Promise((resolve) => setTimeout(resolve, resultHoldMs));
        }
      } catch {
        if (!cancelled) {
          done = clientFallbackOutcome();
        }
      } finally {
        stageRef.current?.clear();
        setResult(null);
        if (!cancelled) {
          finishOnce(done ?? clientFallbackOutcome());
        }
      }
    })();

    return () => {
      cancelled = true;
      // Чтобы Strict Mode / смена stageReady могли заново стартовать тот же token.
      startedLocalTokensRef.current.delete(active.token);
      stageRef.current?.clear();
    };
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

    if (!canAnimateIncoming(request, getDiceAnimationSpeedSync(), isFocused)) {
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
    // Актуальная скорость — вдруг только что сменили в поповере.
    const liveSpeed = getDiceAnimationSpeedSync();
    animationSpeedRef.current = liveSpeed;
    const resultHoldMs = liveSpeed === 'fast' ? 500 : 1100;
    const notationParts = payloadToStageNotation(active.payload).map(
      (part) => `${part.qty}d${part.sides}`,
    );
    const notation =
      notationParts.length === 0
        ? '1d20'
        : notationParts.length === 1
          ? notationParts[0]
          : notationParts;
    const faces = active.payload.groups.flatMap((g) =>
      g.values.map((value) => ({ sides: g.sides, value })),
    );
    const sum = active.payload.sum;
    const critLabels = diceRollCritLabels(
      active.payload.groups,
      active.payload.mode,
      active.payload.modifier,
    );

    void (async () => {
      let revealed = false;
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        stageRef.current?.resize();
        const rolled = await stageRef.current?.roll(notation);
        if (cancelled || sum == null) {
          return;
        }
        // Карточка всегда из payload. Если 3D всё ещё врёт — убираем куб,
        // чтобы не было двух разных чисел на экране.
        const expectedValues = faces.map((face) => face.value);
        const faceMismatch =
          !rolled ||
          expectedValues.length === 0 ||
          expectedValues.some(
            (value, index) => Number(rolled.values[index]) !== Number(value),
          );
        if (faceMismatch) {
          stageRef.current?.clear();
        }
        onRevealRef.current(active.messageId);
        revealed = true;
        setResult({
          messageId: active.messageId,
          senderNickname: active.senderNickname,
          formula: active.payload.formula,
          faces,
          sum,
          modifier: active.payload.modifier,
          critLabels,
        });
        await new Promise((resolve) => setTimeout(resolve, resultHoldMs));
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
  }, [isFocused, localRoll, request, stageReady]);

  const visible =
    Boolean(localRoll) ||
    (Boolean(request) &&
      animationSpeed !== 'off' &&
      isFocused &&
      Boolean(request && !request.payload.redacted && request.payload.sum != null));

  const throwerNickname =
    localRoll?.senderNickname ?? (visible ? request?.senderNickname : null) ?? null;
  const throwerFormula = localRoll
    ? formatDiceFormula(localRoll.dice, localRoll.modifier, localRoll.mode)
    : visible
      ? request?.payload.formula
      : null;

  if (!engineMounted && !visible && !warm && !isFocused) {
    return null;
  }

  const keepStageHot = Boolean(warm || isFocused || visible);

  const overlay = (
    <View
      style={[
        styles.root,
        visible ? styles.rootActive : styles.rootCollapsed,
        // Тёплая сцена должна быть opacity:1 (хоть и за экраном) — иначе WebKit
        // откладывает первый кадр и снова появляется пауза перед броском.
        keepStageHot && !visible ? { opacity: 1 } : null,
      ]}
      pointerEvents="none"
      collapsable={false}>
      <View style={styles.stage} pointerEvents="none">
        {engineMounted || visible || keepStageHot ? (
          <DiceStage
            ref={stageRef}
            accent={activeAccent}
            skin={activeSkin}
            transparent
            animationSpeed={animationSpeed === 'off' ? 'normal' : animationSpeed}
            onReady={handleStageReady}
          />
        ) : null}
        <DiceCritBurst
          visible={Boolean(result?.critLabels.includes(DICE_CRIT_SUCCESS_LABEL))}
          skinId={activeSkin}
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
            {result.critLabels.length > 0 ? (
              <View style={styles.resultCritRow}>
                {result.critLabels.map((label) => {
                  const isFail = label === DICE_CRIT_FAIL_LABEL;
                  return (
                    <View
                      key={label}
                      style={[
                        styles.resultCritBadge,
                        isFail ? styles.resultCritBadgeFail : styles.resultCritBadgeSuccess,
                      ]}>
                      <Text
                        style={[
                          styles.resultCritBadgeText,
                          isFail
                            ? styles.resultCritBadgeTextFail
                            : styles.resultCritBadgeTextSuccess,
                        ]}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {result.faces.length > 0 ? (
              <View style={styles.resultFaces}>
                {result.faces.map((face, index) => {
                  const mark = diceFaceMark(face.sides, face.value, result.modifier);
                  return (
                    <View
                      key={`${index}-${face.sides}-${face.value}`}
                      style={[
                        styles.resultFace,
                        mark === 'crit_fail' ? styles.resultFaceCritFail : null,
                        mark === 'crit_success' ? styles.resultFaceCritSuccess : null,
                      ]}>
                      <Text
                        style={[
                          styles.resultFaceText,
                          mark === 'crit_fail' ? styles.resultFaceTextCritFail : null,
                          mark === 'crit_success' ? styles.resultFaceTextCritSuccess : null,
                        ]}>
                        {face.value}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            <Text
              style={[
                styles.resultSum,
                result.critLabels.includes(DICE_CRIT_FAIL_LABEL)
                  ? styles.resultSumCritFail
                  : null,
                result.critLabels.includes(DICE_CRIT_SUCCESS_LABEL)
                  ? styles.resultSumCritSuccess
                  : null,
              ]}>
              {result.sum}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  // iOS: iframe/WebGL под ScreenTransition(transform) пустой. Portal + нативный fixed-shell.
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const portalHidden = !visible;
    return createPortal(
      createElement(
        'div',
        {
          id: 'adventura-chat-dice-portal',
          style: {
            position: 'fixed',
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: visible ? 10000 : -1,
            // Тёплую сцену не гасим opacity — только уводим за экран.
            opacity: visible || keepStageHot ? 1 : 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            top: portalHidden ? '-100vh' : 0,
            right: 0,
            bottom: portalHidden ? 'auto' : 0,
          },
          'aria-hidden': true,
        },
        overlay,
      ),
      document.body,
    );
  }

  return overlay;
}
