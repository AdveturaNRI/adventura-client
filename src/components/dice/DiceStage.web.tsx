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
  {
    onReady,
    onDone,
    transparent = false,
    accent,
    skin,
    animationSpeed = 'normal',
    scale,
    centerSpawn = false,
  },
  ref,
) {
  const colors = useTheme();
  const themeAccent = accent?.trim() || colors.primary || DEFAULT_DICE_ACCENT;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const accentRef = useRef(themeAccent);
  accentRef.current = themeAccent;
  const skinRef = useRef(skin ?? 'standard');
  skinRef.current = skin ?? 'standard';
  const centerRef = useRef(centerSpawn);
  centerRef.current = centerSpawn;
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
          // Новый roll снимает предыдущий pending — иначе «белый» бросок
          // потом всё равно resolve'ится и даёт повтор.
          pendingRef.current?.reject(new Error('Dice roll superseded'));
          setError(null);
          pendingRef.current = { resolve, reject };
          postToIframe({
            type: 'roll',
            notation,
            themeColor: accentRef.current,
            skin: skinRef.current,
            speed: speedRef.current,
            center: centerRef.current,
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
          skin: skinRef.current,
          speed: speedRef.current,
        });
      },
      clear: () => {
        const pending = pendingRef.current;
        pendingRef.current = null;
        setError(null);
        postToIframe({ type: 'clear' });
        // Не оставляем висящий Promise — иначе overlay ждёт done и шлёт fallback + поздний result.
        pending?.reject(new Error('Dice roll cleared'));
      },
      resize: () => {
        if (!ready) {
          return;
        }
        postToIframe({ type: 'resize' });
      },
    }),
    [ready],
  );

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      // Без iframe не принимаем чужие postMessage (вкладки «Дайсы» + чат
      // иначе ловят done друг друга и плодят лишние resolve/onDone).
      if (!iframeWindow || event.source !== iframeWindow) {
        return;
      }
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
          console.warn('[DiceStage]', message);
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

  // Chat and DiceScreen share Babylon @3d-dice/dice-box (threejs chat fork is broken on mobile).
  // Remote face sync: overlay clears die on mismatch and shows the result card.
  const scaleParam = scale && scale > 0 ? `&scale=${encodeURIComponent(String(scale))}` : '';
  const centerParam = centerSpawn ? '&center=1' : '';
  const src = `/dice-stage.html?transparent=${transparent ? 1 : 0}&v=dicemin2${scaleParam}${centerParam}`;

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

  const onIframeLoad = () => {
    // Если ready ушёл до подписки родителя — переспросим.
    postToIframe({ type: 'ping' });
  };

  return createElement(
    'div',
    {
      style: {
        flex: 1,
        width: '100%',
        height: '100%',
        minHeight: transparent ? 120 : 260,
        borderRadius: transparent ? 0 : 20,
        overflow: 'hidden',
        background: shellBg,
        position: 'relative',
        pointerEvents: 'none',
      },
    },
    createElement('iframe', {
      ref: iframeRef,
      title: 'Dice roller',
      src,
      onLoad: onIframeLoad,
      // iOS Safari: full-screen iframe can eat touches even under opacity:0 parents.
      // Keep the stage visual-only; chat UI stays interactive underneath.
      tabIndex: -1,
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
        background: shellBg,
        backgroundColor: shellBg,
        colorScheme: 'normal',
        pointerEvents: 'none',
      },
      // Без sandbox: WebKit роняет динамический import() внутри sandbox-iframe
      // («Importing a module script failed»), а dice-box так тянет world.onscreen.
      // allow-scripts + allow-same-origin на своём же origin защиты и не давали.
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
