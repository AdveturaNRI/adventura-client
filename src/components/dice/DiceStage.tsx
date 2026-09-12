import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';

import { buildDiceBoxNativeHtml } from '@/components/dice/dice-box-native-html';
import { FontSize, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemedStyles } from '@/hooks/use-themed-styles';

import type { DiceNotation, DiceRollOutcome, DiceStageHandle, DiceStageProps } from './dice-stage.types';

export type { DiceRollOutcome, DiceStageHandle };

const WebView = RNWebView as unknown as ComponentType<Record<string, unknown>>;

type WebBridge = {
  injectJavaScript?: (script: string) => void;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      minHeight: 260,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: '#0B1220',
    },
    web: {
      flex: 1,
      backgroundColor: '#0B1220',
    },
    fallback: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    fallbackText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: FontSize.label,
    },
  });
}

/**
 * Native: WebView wrapper around the same @3d-dice/dice-box engine (CDN assets).
 */
export const DiceStage = forwardRef<DiceStageHandle, DiceStageProps>(function DiceStage(
  { onReady, onDone },
  ref,
) {
  const colors = useTheme();
  const styles = useThemedStyles(createStyles);
  const bridgeRef = useRef<WebBridge | null>(null);
  const pendingRef = useRef<{
    resolve: (outcome: DiceRollOutcome) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const send = useCallback((payload: Record<string, unknown>) => {
    const json = JSON.stringify(payload);
    bridgeRef.current?.injectJavaScript?.(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} })); true;`,
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      roll: (notation: DiceNotation) =>
        new Promise<DiceRollOutcome>((resolve, reject) => {
          pendingRef.current = { resolve, reject };
          send({ type: 'roll', notation });
        }),
      preview: (notation) => {
        send({ type: 'preview', notation: notation ?? [] });
      },
      clear: () => {
        pendingRef.current = null;
        send({ type: 'clear' });
      },
    }),
    [send],
  );

  const html = buildDiceBoxNativeHtml({ accent: colors.primary });

  return (
    <View style={styles.wrap}>
      {failed ? (
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>
            Нужен интернет, чтобы загрузить 3D-кубики на устройстве
          </Text>
        </View>
      ) : (
        <WebView
          ref={(node: WebBridge | null) => {
            bridgeRef.current = node;
          }}
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://unpkg.com' }}
          onMessage={(event: { nativeEvent: { data: string } }) => {
            try {
              const data = JSON.parse(event.nativeEvent.data) as {
                type?: string;
                outcome?: DiceRollOutcome;
                message?: string;
              };
              if (data.type === 'ready') {
                onReady?.();
              }
              if (data.type === 'done' && data.outcome) {
                pendingRef.current?.resolve(data.outcome);
                pendingRef.current = null;
                onDone?.(data.outcome);
              }
              if (data.type === 'error') {
                setFailed(true);
                pendingRef.current?.reject(new Error(data.message || 'Dice error'));
                pendingRef.current = null;
              }
            } catch {
              // ignore
            }
          }}
          style={styles.web}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
        />
      )}
    </View>
  );
});
