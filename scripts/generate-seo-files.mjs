#!/usr/bin/env node
/**
 * Writes robots.txt and sitemap.xml into the web export (dist/ by default).
 * Page list: src/seo/sitemap-pages.json. Run after `expo export -p web`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, process.argv[2] ?? 'dist');
const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://adventu.ru').replace(/\/+$/, '');

if (!existsSync(outDir)) {
  console.error(`[seo] ${outDir} not found, run expo export first`);
  process.exit(1);
}

const pages = JSON.parse(readFileSync(join(root, 'src/seo/sitemap-pages.json'), 'utf8'));
const lastmod = new Date().toISOString().slice(0, 10);

const escapeXml = (value) =>
  value.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    (page) => `  <url>
    <loc>${escapeXml(siteUrl + page.path)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`;

// Private sections redirect guests to login; there's nothing to index there.
const disallow = [
  '/auth/',
  '/wanderers',
  '/chats',
  '/users/',
  '/profile',
  '/settings',
  '/notifications',
  '/questionnaire',
  '/characters',
  '/master-room',
  '/my-games',
  '/my-clubs',
  '/games-create',
  '/games-edit',
  '/games-manage',
  '/clubs-create',
  '/clubs-edit',
  '/author-cabinet',
  '/music-library',
  '/rewards-lab',
  '/ui-lib/',
  '/_sitemap',
  '/(',
  '/maintenance.html',
];

const robots = `User-agent: *
Allow: /
${disallow.map((path) => `Disallow: ${path}`).join('\n')}

# Yandex: one URL per page regardless of ad tags.
User-agent: Yandex
Allow: /
${disallow.map((path) => `Disallow: ${path}`).join('\n')}
Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&adv_variant&next

Sitemap: ${siteUrl}/sitemap.xml
`;

writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
writeFileSync(join(outDir, 'robots.txt'), robots);
console.log(`[seo] sitemap.xml (${pages.length} urls) and robots.txt → ${outDir}`);
