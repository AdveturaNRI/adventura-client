import type { Href, Router } from 'expo-router';

import {
  getNavSection,
  type NavLeaf,
  type NavSection,
  type NavSectionId,
} from '@/components/ui/navigation/nav.sections';
import { buildLoginHref, isPublicTabKey } from '@/constants/auth-routes';

function canOpenLeaf(leaf: NavLeaf, isAuthenticated: boolean | undefined): boolean {
  if (isAuthenticated !== false) return true;
  if (leaf.public === true) return true;
  return isPublicTabKey(leaf.routeKey);
}

/** Open a leaf route; no-op when already on that leaf root. */
export function navigateNavLeaf(
  router: Router,
  leaf: NavLeaf,
  pathname: string | null | undefined,
  options?: { isAuthenticated?: boolean },
) {
  if (pathname === leaf.href || pathname === `${leaf.href}/`) {
    return;
  }

  if (!canOpenLeaf(leaf, options?.isAuthenticated)) {
    router.push(buildLoginHref(leaf.href));
    return;
  }

  router.navigate(leaf.href as Href);
}

/** Open section default (rootHref). */
export function navigateNavSection(
  router: Router,
  section: NavSection | NavSectionId,
  pathname: string | null | undefined,
  options?: { isAuthenticated?: boolean },
) {
  const resolved = typeof section === 'string' ? getNavSection(section) : section;
  const rootLeaf =
    resolved.items.find((item) => item.href === resolved.rootHref) ?? resolved.items[0];
  if (!rootLeaf) return;
  navigateNavLeaf(router, rootLeaf, pathname, options);
}
