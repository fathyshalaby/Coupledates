import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const metadata = JSON.parse(
  readFileSync(new URL('../src/lib/seo-metadata.json', import.meta.url), 'utf8'),
).couplesJournal;
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const builtJournalPath = new URL('../dist/public/couples-journal/index.html', import.meta.url);
const defaultSiteOrigin = 'https://couple-dates.replit.app';
const testSiteOrigin = 'https://journal-preview.example';

function buildJournalHtml(publicSiteUrl) {
  const buildEnv = {
    ...process.env,
    BASE_PATH: '/',
    PORT: process.env.PORT || '8080',
  };
  if (publicSiteUrl) {
    buildEnv.PUBLIC_SITE_URL = publicSiteUrl;
  } else {
    delete buildEnv.PUBLIC_SITE_URL;
  }

  execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.config.ts'], {
    cwd: packageRoot,
    env: buildEnv,
    stdio: 'pipe',
  });
  return readFileSync(builtJournalPath, 'utf8');
}

function getAttribute(html, tagName, attribute, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<${tagName}\\b(?=[^>]*\\b${attribute}="${escapedValue}")[^>]*>`, 'i'))?.[0];
  assert.ok(tag, `Expected ${tagName} with ${attribute}="${value}" in built journal route`);
  return tag.match(/\bcontent="([^"]*)"/i)?.[1];
}

function assertJournalMetadata(html, siteOrigin) {
  const basePath = '';
  const canonicalUrl = new URL(`${basePath}/couples-journal`, siteOrigin).href;
  const imageUrl = new URL(`${basePath}/${metadata.image}`, siteOrigin).href;
  const escapedTitle = metadata.title.replaceAll('&', '&amp;');
  const escapedDescription = metadata.description.replaceAll('&', '&amp;');
  assert.ok(html.includes(`<title>${escapedTitle}</title>`));
  assert.equal(getAttribute(html, 'meta', 'name', 'description'), escapedDescription);
  assert.equal(getAttribute(html, 'meta', 'property', 'og:title'), escapedTitle);
  assert.equal(getAttribute(html, 'meta', 'property', 'og:description'), escapedDescription);
  assert.equal(getAttribute(html, 'meta', 'property', 'og:image'), imageUrl);
  assert.equal(getAttribute(html, 'meta', 'property', 'og:url'), canonicalUrl);
  assert.equal(getAttribute(html, 'meta', 'name', 'twitter:title'), escapedTitle);
  assert.equal(getAttribute(html, 'meta', 'name', 'twitter:description'), escapedDescription);
  assert.equal(getAttribute(html, 'meta', 'name', 'twitter:image'), imageUrl);
  assert.match(html, new RegExp(`<link\\s+rel="canonical"\\s+href="${canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module"/);
}

test('the built journal route uses the configured origin and a deterministic local default', () => {
  assertJournalMetadata(buildJournalHtml(testSiteOrigin), testSiteOrigin);
  assertJournalMetadata(buildJournalHtml(), defaultSiteOrigin);
});
