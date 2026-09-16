import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  payloadToForcedNotation,
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

type ChatDiceOverlayProps = {
  request: ChatDiceOverlayRequest | null;
  onFinished: (messageId: string) => void;
  /** Поднять iframe заранее (открыли меню броска) — без холодного старта на первом броске. */
  warm?: boolean;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 40,
      pointerEvents: 'none',
    },
    rootCollapsed: {
      // WKWebView/Android WebView игнорируют pointerEvents родителя и едят скролл чата,
      // пока лежат absoluteFill даже с opacity: 0.
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
    resultWrap: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
    },
    resultCard: {
      minWidth: 160,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.lg,
      borderRadius: 20,
      backgroundColor: 'rgba(11, 18, 32, 0.82)',
      borderWidth: 1,
      borderColor: 'rgba(21, 122, 254, 0.45)',
      alignItems: 'center',
      gap: 6,
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

function canAnimateRequest(
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

/**
 * Transparent dice animation over the chat thread.
 * One DiceStage iframe stays mounted — remounting on every color/roll OOMs Chrome.
 */
export function ChatDiceOverlay({ request, onFinished, warm = false }: ChatDiceOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const isFocused = useIsFocused();
  const stageRef = useRef<DiceStageHandle>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const { accent: localAccent } = useDiceAccentColor();

  const rollAccent = coerceDiceAccent(request?.payload.color ?? localAccent);

  const [stageReady, setStageReady] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(getDiceAnimationsEnabledSync);
  const [engineMounted, setEngineMounted] = useState(false);

  const handleStageReady = useRef(() => {
    setStageReady(true);
  }).current;

  useEffect(() => {
    void loadDiceAnimationsEnabled().then(setAnimationsEnabled);
  }, [request?.messageId]);

  useEffect(() => {
    if (warm || request) {
      setEngineMounted(true);
    }
  }, [warm, request]);

  useEffect(() => {
    if (!request) {
      setShowResult(false);
      if (stageReady) {
        stageRef.current?.clear();
      }
      return;
    }

    if (!canAnimateRequest(request, animationsEnabled, isFocused)) {
      onFinishedRef.current(request.messageId);
      return;
    }

    if (!stageReady) {
      let cancelled = false;
      const readyTimeout = setTimeout(() => {
        if (!cancelled) {
          onFinishedRef.current(request.messageId);
        }
      }, 8000);
      return () => {
        cancelled = true;
        clearTimeout(readyTimeout);
      };
    }

    let cancelled = false;
    const messageId = request.messageId;
    const notation = payloadToForcedNotation(request.payload);

    void (async () => {
      try {
        await stageRef.current?.roll(notation.length > 0 ? notation : '1d20');
        if (cancelled) {
          return;
        }
        setShowResult(true);
        await new Promise((resolve) => setTimeout(resolve, 900));
      } catch {
        if (cancelled) {
          return;
        }
      } finally {
        if (!cancelled) {
          stageRef.current?.clear();
          setShowResult(false);
          onFinishedRef.current(messageId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [animationsEnabled, isFocused, request, stageReady]);

  const visible =
    Boolean(request) &&
    animationsEnabled &&
    isFocused &&
    Boolean(request && !request.payload.redacted && request.payload.sum != null);

  // Держим движок тёплым при открытом меню / активном броске, иначе схлопываем,
  // чтобы WebView не перехватывал скролл ленты.
  const expanded = visible || warm;

  if (!engineMounted && !visible && !warm) {
    return null;
  }

  return (
    <View
      style={[styles.root, !expanded ? styles.rootCollapsed : null]}
      pointerEvents="none"
      collapsable={false}>
      <View style={styles.stage} pointerEvents="none">
        <DiceStage
          ref={stageRef}
          accent={rollAccent}
          transparent
          onReady={handleStageReady}
        />
      </View>
      {showResult && request?.payload.sum != null ? (
        <View style={styles.resultWrap} pointerEvents="none">
          <View style={styles.resultCard}>
            <Text style={styles.resultWho}>{request.senderNickname}</Text>
            <Text style={styles.resultFormula}>{request.payload.formula}</Text>
            <Text style={styles.resultSum}>{request.payload.sum}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
