#!/usr/bin/env node
/**
 * Writes robots.txt and sitemap.xml into the web export (dist/ by default).
 * Page list: src/seo/sitemap-pages.json. Run after `expo export -p web`.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertRobotsSafe,
  buildRobotsTxt,
  buildSitemapXml,
} from './seo/build-seo-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, process.argv[2] ?? 'dist');
const siteUrl = (process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://adventu.ru').replace(
  /\/+$/,
  '',
);

if (!existsSync(outDir)) {
  console.error(`[seo] ${outDir} not found, run expo export first`);
  process.exit(1);
}

const pagesPath = join(root, 'src/seo/sitemap-pages.json');
const disallowPath = join(root, 'src/seo/robots-disallow.json');
const pages = JSON.parse(readFileSync(pagesPath, 'utf8'));
const disallow = JSON.parse(readFileSync(disallowPath, 'utf8'));

// Prefer content mtime over "today on every build" so lastmod only moves when the list changes.
const defaultLastmod = new Date(statSync(pagesPath).mtimeMs).toISOString().slice(0, 10);

const sitemap = buildSitemapXml(pages, siteUrl, defaultLastmod);
const robots = buildRobotsTxt(disallow, siteUrl);
assertRobotsSafe(robots);

writeFileSync(join(outDir, 'sitemap.xml'), sitemap);
writeFileSync(join(outDir, 'robots.txt'), robots);
console.log(`[seo] sitemap.xml (${pages.length} urls) and robots.txt → ${outDir}`);
