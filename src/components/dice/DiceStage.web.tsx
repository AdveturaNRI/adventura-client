import {
  createElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { useTheme } from '@/hooks/use-theme';

import type {
  DiceNotation,
  DiceRollOutcome,
  DiceStageHandle,
  DiceStageProps,
} from './dice-stage.types';

export type { DiceRollOutcome, DiceStageHandle };

/**
 * Web: @3d-dice/dice-box via local public/dice-roller.html
 */
export const DiceStage = forwardRef<DiceStageHandle, DiceStageProps>(function DiceStage(
  { onReady, onDone },
  ref,
) {
  const colors = useTheme();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const pendingRef = useRef<{
    resolve: (outcome: DiceRollOutcome) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Тянем 3D-движок…');
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
        if (data.type === 'status' && data.message) {
          setStatus(data.message);
        }
        if (data.type === 'ready') {
          setReady(true);
          setStatus('');
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

  const src = `/dice-roller.html?accent=${encodeURIComponent(colors.primary)}`;

  return createElement(
    'div',
    {
      style: {
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: 260,
        borderRadius: 20,
        overflow: 'hidden',
        background: '#0B1220',
        position: 'relative',
      },
    },
    createElement('iframe', {
      ref: iframeRef,
      title: 'Dice roller',
      src,
      style: {
        width: '100%',
        height: '100%',
        minHeight: 260,
        border: '0',
        display: 'block',
        background: '#0B1220',
      },
      sandbox: 'allow-scripts allow-same-origin',
      allow: 'accelerometer; gyroscope',
    }),
    !ready && !error
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
              fontWeight: 600,
              padding: 24,
              textAlign: 'center',
              background: 'rgba(11,18,32,0.35)',
              pointerEvents: 'none',
            },
          },
          status || 'Загрузка…',
        )
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
              background: 'rgba(11,18,32,0.92)',
            },
          },
          error,
        )
      : null,
  );
});
