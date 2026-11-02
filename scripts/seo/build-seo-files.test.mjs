import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  assertRobotsSafe,
  buildRobotsTxt,
  buildSitemapXml,
  escapeXml,
} from './build-seo-files.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const disallow = JSON.parse(readFileSync(join(root, 'src/seo/robots-disallow.json'), 'utf8'));
const pages = JSON.parse(readFileSync(join(root, 'src/seo/sitemap-pages.json'), 'utf8'));

describe('robots.txt', () => {
  it('does not emit Disallow: /( Expo group junk', () => {
    const robots = buildRobotsTxt(disallow, 'https://adventu.ru');
    assertRobotsSafe(robots);
    assert.equal(robots.includes('Disallow: /('), false);
  });

  it('keeps Yandex Clean-param and Sitemap', () => {
    const robots = buildRobotsTxt(disallow, 'https://adventu.ru');
    assert.match(robots, /^User-agent: Yandex$/m);
    assert.match(
      robots,
      /^Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&adv_variant&next$/m,
    );
    assert.match(robots, /^Sitemap: https:\/\/adventu\.ru\/sitemap\.xml$/m);
  });

  it('blocks private surfaces without blanket-blocking /games or /clubs', () => {
    const robots = buildRobotsTxt(disallow, 'https://adventu.ru');
    for (const path of ['/auth/', '/chats', '/settings', '/profile', '/games-manage', '/author-cabinet']) {
      assert.match(robots, new RegExp(`^Disallow: ${path.replace('/', '\\/')}$`, 'm'));
    }
    assert.equal(robots.includes('Disallow: /games\n'), false);
    assert.equal(robots.includes('Disallow: /clubs\n'), false);
    assert.equal(robots.includes('Disallow: /authors\n'), false);
    assert.equal(robots.includes('Disallow: /l/'), false);
  });

  it('rejects illegal Disallow when present', () => {
    assert.throws(() => assertRobotsSafe('User-agent: *\nDisallow: /(\n'), /Illegal robots/);
  });
});

describe('sitemap.xml', () => {
  it('emits absolute https locs without duplicates', () => {
    const xml = buildSitemapXml(
      [...pages, pages[0]],
      'https://adventu.ru',
      '2026-01-15',
    );
    assert.match(xml, /<loc>https:\/\/adventu\.ru\/<\/loc>/);
    assert.match(xml, /<loc>https:\/\/adventu\.ru\/games<\/loc>/);
    assert.match(xml, /<loc>https:\/\/adventu\.ru\/l\/welcome<\/loc>/);
    assert.equal((xml.match(/<loc>https:\/\/adventu\.ru\/<\/loc>/g) || []).length, 1);
    assert.match(xml, /<lastmod>2026-01-15<\/lastmod>/);
  });

  it('escapes XML special characters', () => {
    assert.equal(escapeXml('a&b'), 'a&amp;b');
    const xml = buildSitemapXml(
      [{ path: '/a&b', changefreq: 'weekly', priority: 0.5 }],
      'https://adventu.ru',
      '2026-01-15',
    );
    assert.match(xml, /<loc>https:\/\/adventu\.ru\/a&amp;b<\/loc>/);
  });

  it('only lists hub/public paths from sitemap-pages.json', () => {
    for (const page of pages) {
      assert.equal(page.path.startsWith('/'), true);
      assert.equal(page.path.includes('['), false);
      assert.equal(page.path === '/auth' || page.path.startsWith('/auth/'), false);
      assert.equal(page.path === '/chats' || page.path.startsWith('/chats/'), false);
    }
  });
});
