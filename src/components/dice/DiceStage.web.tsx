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
 */
export const DiceStage = forwardRef<DiceStageHandle, DiceStageProps>(function DiceStage(
  { onReady, onDone, transparent = false, accent },
  ref,
) {
  const colors = useTheme();
  const themeAccent = accent?.trim() || colors.primary || DEFAULT_DICE_ACCENT;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
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
          pendingRef.current = { resolve, reject };
          postToIframe({ type: 'roll', notation });
        }),
      preview: (notation) => {
        if (!ready) {
          return;
        }
        postToIframe({ type: 'preview', notation: notation ?? [] });
      },
      clear: () => {
        pendingRef.current = null;
        postToIframe({ type: 'clear' });
      },
    }),
    [ready],
  );

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      try {
        const data =
          typeof event.data === 'string'
            ? (JSON.parse(event.data) as {
                type?: string;
                outcome?: DiceRollOutcome;
                message?: string;
              })
            : null;
        if (!data?.type) {
          return;
        }
        if (data.type === 'ready') {
          setReady(true);
          onReady?.();
        }
        if (data.type === 'done' && data.outcome) {
          pendingRef.current?.resolve(data.outcome);
          pendingRef.current = null;
          onDoneRef.current?.(data.outcome);
        }
        if (data.type === 'error') {
          setError(data.message || 'Ошибка 3D-кубиков');
          pendingRef.current?.reject(new Error(data.message || 'Dice error'));
          pendingRef.current = null;
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', onWindowMessage);
    return () => window.removeEventListener('message', onWindowMessage);
  }, [onReady]);

  const src = `/dice-stage.html?accent=${encodeURIComponent(themeAccent)}${
    transparent ? '&transparent=1' : ''
  }`;

  useEffect(() => {
    setReady(false);
    setError(null);
  }, [src]);

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
      key: src,
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
        pointerEvents: 'none',
      },
      sandbox: 'allow-scripts allow-same-origin',
      allow: 'accelerometer; gyroscope',
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
