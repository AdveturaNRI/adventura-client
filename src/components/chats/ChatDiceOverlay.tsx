import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import { DiceStage, type DiceStageHandle } from '@/components/dice/DiceStage';
import { FontSize, Spacing, type ThemeColors } from '@/constants/theme';
import { useDiceAccentColor } from '@/hooks/use-dice-accent-color';
import { useThemedStyles } from '@/hooks/use-themed-styles';
import {
  payloadToNotationParts,
  type DiceRollPayload,
} from '@/utils/chat-dice-roll';
import {
  getDiceAnimationsEnabledSync,
  loadDiceAnimationsEnabled,
} from '@/utils/dice-animations-storage';

export type ChatDiceOverlayRequest = {
  messageId: string;
  payload: DiceRollPayload;
  senderNickname: string;
};

type ChatDiceOverlayProps = {
  request: ChatDiceOverlayRequest | null;
  onFinished: (messageId: string) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 40,
      pointerEvents: 'none',
    },
    rootHidden: {
      opacity: 0,
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
 * DiceStage stays mounted after the first roll so the next throw doesn't race a cold iframe.
 */
export function ChatDiceOverlay({ request, onFinished }: ChatDiceOverlayProps) {
  const styles = useThemedStyles(createStyles);
  const isFocused = useIsFocused();
  const stageRef = useRef<DiceStageHandle>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const { accent } = useDiceAccentColor();

  const [stageReady, setStageReady] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(getDiceAnimationsEnabledSync);
  const [engineMounted, setEngineMounted] = useState(false);

  useEffect(() => {
    void loadDiceAnimationsEnabled().then(setAnimationsEnabled);
  }, [request?.messageId]);

  useEffect(() => {
    setStageReady(false);
  }, [accent]);

  useEffect(() => {
    if (!request) {
      setShowResult(false);
      stageRef.current?.clear();
      return;
    }

    if (!canAnimateRequest(request, animationsEnabled, isFocused)) {
      onFinishedRef.current(request.messageId);
      return;
    }

    setEngineMounted(true);

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
    const notation = payloadToNotationParts(request.payload);

    void (async () => {
      try {
        await stageRef.current?.roll(notation.length > 0 ? notation : '1d20');
        if (cancelled) {
          return;
        }
        setShowResult(true);
        await new Promise((resolve) => setTimeout(resolve, 900));
      } catch {
        // reveal bubble anyway
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

  if (!engineMounted && !visible) {
    return null;
  }

  return (
    <View
      style={[styles.root, !visible ? styles.rootHidden : null]}
      pointerEvents="none"
      collapsable={false}>
      <View style={styles.stage} pointerEvents="none">
        <DiceStage
          key={accent}
          ref={stageRef}
          accent={accent}
          transparent
          onReady={() => setStageReady(true)}
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
