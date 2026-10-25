import { useEffect, useState } from 'react';

import {
  getWelcomeLanding,
  peekWelcomeLanding,
  type WelcomeLanding,
} from '@/services/marketing/welcome';

/** Welcome landing from public config; null while loading or when none is set. */
export function useWelcomeLanding(): WelcomeLanding | null {
  const [landing, setLanding] = useState<WelcomeLanding | null>(peekWelcomeLanding);

  useEffect(() => {
    let cancelled = false;
    void getWelcomeLanding().then((next) => {
      if (!cancelled) setLanding(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return landing;
}
