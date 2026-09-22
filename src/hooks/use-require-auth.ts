import { usePathname, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { buildLoginHref } from '@/constants/auth-routes';
import { useAuth } from '@/context/AuthContext';

/** Returns false and redirects to login when the user is anonymous. */
export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (returnTo?: string) => {
      if (isAuthenticated) {
        return true;
      }
      router.push(buildLoginHref(returnTo ?? pathname));
      return false;
    },
    [isAuthenticated, pathname, router],
  );
}
