import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_DICE_ACCENT } from '@/utils/dice-color-storage';

import type {
  DiceNotation,
  DiceRollOutcome,
  DiceStageHandle,
  DiceStageProps,
} from './dice-stage.types';

export type { DiceRollOutcome, DiceStageHandle };

/**
 * Web: @3d-dice/dice-box via local public/dice-stage.html
 * Not under /dice-box (postinstall wipes that folder) and not /dice-roller.html
 * (browsers may still have a cached 301 to /dice-roller from serve cleanUrls).
 *
 * Accent is sent per roll via postMessage — never remount the iframe on color change
 * (that leaks WebGL contexts and crashes the tab after many rolls).
 */
export const DiceStage = forwardRef<DiceStageHandle, DiceStageProps>(function DiceStage(
  { onReady, onDone, transparent = false, accent, animationSpeed = 'normal' },
  ref,
) {
  const colors = useTheme();
  const themeAccent = accent?.trim() || colors.primary || DEFAULT_DICE_ACCENT;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const accentRef = useRef(themeAccent);
  accentRef.current = themeAccent;
  const speedRef = useRef(animationSpeed);
  speedRef.current = animationSpeed;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const pendingRef = useRef<{
    resolve: (outcome: DiceRollOutcome) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postToIframe = (payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  };

  useImperativeHandle(
    ref,
    () => ({
      roll: (notation: DiceNotation) =>
        new Promise<DiceRollOutcome>((resolve, reject) => {
          if (!ready) {
            reject(new Error('Dice box is not ready'));
            return;
          }
          setError(null);
          pendingRef.current = { resolve, reject };
          postToIframe({
            type: 'roll',
            notation,
            themeColor: accentRef.current,
            speed: speedRef.current,
          });
        }),
      preview: (notation) => {
        if (!ready) {
          return;
        }
        postToIframe({
          type: 'preview',
          notation: notation ?? [],
          themeColor: accentRef.current,
          speed: speedRef.current,
        });
      },
      clear: () => {
        pendingRef.current = null;
        setError(null);
        postToIframe({ type: 'clear' });
      },
    }),
    [ready],
  );

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      try {
        const raw = event.data;
        let data: {
          type?: string;
          outcome?: DiceRollOutcome;
          message?: string;
        } | null = null;
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          if (!trimmed.startsWith('{')) {
            return;
          }
          data = JSON.parse(trimmed) as {
            type?: string;
            outcome?: DiceRollOutcome;
            message?: string;
          };
        } else if (raw && typeof raw === 'object') {
          data = raw as {
            type?: string;
            outcome?: DiceRollOutcome;
            message?: string;
          };
        }
        if (!data?.type) {
          return;
        }
        if (data.type === 'ready') {
          setReady(true);
          setError(null);
          onReadyRef.current?.();
        }
        if (data.type === 'done' && data.outcome) {
          setError(null);
          pendingRef.current?.resolve(data.outcome);
          pendingRef.current = null;
          onDoneRef.current?.(data.outcome);
        }
        if (data.type === 'error') {
          const message = data.message || 'Не удалось бросить кости';
          // В чате не рисуем сырой SyntaxError поверх ленты — бросок уйдёт в fallback.
          if (!transparent) {
            setError(message);
          }
          pendingRef.current?.reject(new Error(message));
          pendingRef.current = null;
        }
      } catch {
        // Чужие window.message — не наши.
      }
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [transparent]);

  // Chat overlay uses threejs fork — supports forced `@values` for synced faces.
  // `v=` busts iframe cache after stage HTML / force-sync fixes.
  const src = transparent
    ? `/chat-dice-stage.html?transparent=1&v=speed1`
    : `/dice-stage.html?transparent=0&v=speed1`;

  useEffect(() => {
    setReady(false);
    setError(null);
  }, [src]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    postToIframe({ type: 'setAccent', themeColor: themeAccent });
  }, [ready, themeAccent]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    postToIframe({ type: 'setSpeed', speed: animationSpeed });
  }, [ready, animationSpeed]);

  const shellBg = transparent ? 'transparent' : '#0B1220';

  return createElement(
    'div',
    {
      style: {
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: transparent ? 0 : 260,
        borderRadius: transparent ? 0 : 20,
        overflow: 'hidden',
        background: shellBg,
        position: 'relative',
        pointerEvents: transparent ? 'none' : 'auto',
      },
    },
    createElement('iframe', {
      ref: iframeRef,
      title: 'Dice roller',
      src,
      style: {
        width: '100%',
        height: '100%',
        minHeight: transparent ? 0 : 260,
        border: '0',
        display: 'block',
        background: shellBg,
        backgroundColor: shellBg,
        colorScheme: 'normal',
        pointerEvents: 'none',
      },
      sandbox: 'allow-scripts allow-same-origin',
      allow: 'autoplay; accelerometer; gyroscope',
    }),
    !ready && !error && !transparent
      ? createElement('div', {
          style: {
            position: 'absolute',
            inset: 0,
            background: '#0B1220',
            pointerEvents: 'none',
          },
          'aria-hidden': true,
        })
      : null,
    error
      ? createElement(
          'div',
          {
            style: {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.75)',
              fontSize: 14,
              padding: 24,
              textAlign: 'center',
              background: transparent ? 'transparent' : 'rgba(11,18,32,0.92)',
              pointerEvents: 'none',
            },
          },
          error,
        )
      : null,
  );
});
