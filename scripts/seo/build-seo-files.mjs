/**
 * Pure builders for robots.txt / sitemap.xml (also used by unit tests).
 */

/** @param {string} value */
export function escapeXml(value) {
  return value.replace(
    /[<>&'"]/g,
    (ch) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[ch],
  );
}

/**
 * @param {string[]} disallow
 * @param {string} siteUrl
 */
export function buildRobotsTxt(disallow, siteUrl) {
  const origin = siteUrl.replace(/\/+$/, '');
  const block = disallow.map((path) => `Disallow: ${path}`).join('\n');

  // `next` is only used on /auth/* (already Disallow) — Clean-param is safe.
  return `User-agent: *
Allow: /
${block}

# Yandex: collapse ad/analytics query variants to one URL.
User-agent: Yandex
Allow: /
${block}
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&adv_variant&next

Sitemap: ${origin}/sitemap.xml
`;
}

/**
 * @param {{ path: string, changefreq: string, priority: number, lastmod?: string }[]} pages
 * @param {string} siteUrl
 * @param {string} defaultLastmod YYYY-MM-DD
 */
export function buildSitemapXml(pages, siteUrl, defaultLastmod) {
  const origin = siteUrl.replace(/\/+$/, '');
  const seen = new Set();

  const urls = [];
  for (const page of pages) {
    const path = page.path.startsWith('/') ? page.path : `/${page.path}`;
    if (seen.has(path)) continue;
    seen.add(path);
    const lastmod = page.lastmod || defaultLastmod;
    urls.push(`  <url>
    <loc>${escapeXml(origin + path)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${escapeXml(page.changefreq)}</changefreq>
    <priority>${Number(page.priority).toFixed(1)}</priority>
  </url>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

/** Yandex Webmaster rejects bare `Disallow: /(` (Expo route groups are not public URLs). */
export function assertRobotsSafe(robotsTxt) {
  const bad = robotsTxt
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(({ line }) => /^Disallow:\s*\/\(/i.test(line));
  if (bad.length) {
    throw new Error(
      `Illegal robots Disallow for Expo groups: ${bad.map((b) => `L${b.index} ${b.line}`).join('; ')}`,
    );
  }
}
