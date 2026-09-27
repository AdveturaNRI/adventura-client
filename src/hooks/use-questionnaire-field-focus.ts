import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { getQuestionnaireSmoothScrollMs, scheduleScrollAttempts } from '@/utils/scroll-scrollview-to-child';

type UseQuestionnaireFieldFocusOptions = {
  active: boolean;
  scroll: () => boolean;
  onReady?: () => void;
  onComplete?: () => void;
};

/**
 * Smooth-scrolls to a field, then focuses/opens it after the scroll finishes.
 * Focus must use preventScroll — otherwise the browser jumps and kills the animation.
 */
export function useQuestionnaireFieldFocus({
  active,
  scroll,
  onReady,
  onComplete,
}: UseQuestionnaireFieldFocusOptions) {
  const doneRef = useRef(false);
  const scrollRef = useRef(scroll);
  const onReadyRef = useRef(onReady);
  const onCompleteRef = useRef(onComplete);

  scrollRef.current = scroll;
  onReadyRef.current = onReady;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) {
      doneRef.current = false;
      return;
    }

    if (doneRef.current) {
      return;
    }

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let completeTimer: ReturnType<typeof setTimeout> | undefined;

    const settleMs = getQuestionnaireSmoothScrollMs() + (Platform.OS === 'web' ? 40 : 20);

    const cancelAttempts = scheduleScrollAttempts(() => {
      if (doneRef.current) {
        return true;
      }

      if (!scrollRef.current()) {
        return false;
      }

      doneRef.current = true;

      settleTimer = setTimeout(() => {
        onReadyRef.current?.();
        completeTimer = setTimeout(() => {
          onCompleteRef.current?.();
        }, 200);
      }, settleMs);

      return true;
    });

    return () => {
      cancelAttempts();
      if (settleTimer) {
        clearTimeout(settleTimer);
      }
      if (completeTimer) {
        clearTimeout(completeTimer);
      }
    };
  }, [active]);
}
