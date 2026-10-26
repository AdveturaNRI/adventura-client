import Head from 'expo-router/head';
import { usePathname } from 'expo-router';

import { resolveRouteSeo, type RouteSeo } from '@/seo/route-meta';
import { SITE_NAME, SITE_OG_IMAGE } from '@/seo/site';

type Props = Partial<RouteSeo>;

/**
 * Title, description, canonical and Open Graph for the current route.
 * Mounted once in the root layout; screens can render another `<SeoHead>`
 * with overrides (the deepest one wins).
 */
export function SeoHead(overrides: Props) {
  const pathname = usePathname();
  const base = resolveRouteSeo(pathname);
  if (!base) return null;

  const seo = { ...base, ...stripUndefined(overrides) };
  const tags = [
    <title key="title">{seo.title}</title>,
    <meta key="description" name="description" content={seo.description} />,
    <meta
      key="robots"
      name="robots"
      content={seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}
    />,
    <meta key="og:type" property="og:type" content="website" />,
    <meta key="og:site_name" property="og:site_name" content={SITE_NAME} />,
    <meta key="og:locale" property="og:locale" content="ru_RU" />,
    <meta key="og:title" property="og:title" content={seo.title} />,
    <meta key="og:description" property="og:description" content={seo.description} />,
    <meta key="og:image" property="og:image" content={SITE_OG_IMAGE} />,
    <meta key="og:image:width" property="og:image:width" content="1200" />,
    <meta key="og:image:height" property="og:image:height" content="630" />,
    <meta key="twitter:card" name="twitter:card" content="summary_large_image" />,
  ];
  if (seo.canonical) {
    tags.push(
      <link key="canonical" rel="canonical" href={seo.canonical} />,
      <meta key="og:url" property="og:url" content={seo.canonical} />,
    );
  }

  return <Head>{tags}</Head>;
}

function stripUndefined(value: Props): Props {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Props;
}