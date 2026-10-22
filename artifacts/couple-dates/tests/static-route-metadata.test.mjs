import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const metadata = JSON.parse(
  readFileSync(new URL('../src/lib/seo-metadata.json', import.meta.url), 'utf8'),
).couplesJournal;
const html = readFileSync(
  new URL('../dist/public/couples-journal/index.html', import.meta.url),
  'utf8',
);
const siteOrigin = new URL(
  process.env.PUBLIC_SITE_URL || 'https://couple-dates.replit.app',
).origin;
const basePath = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const canonicalUrl = new URL(`${basePath}/couples-journal`, siteOrigin).href;
const imageUrl = new URL(`${basePath}/${metadata.image}`, siteOrigin).href;

function getAttribute(tagName, attribute, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<${tagName}\\b(?=[^>]*\\b${attribute}="${escapedValue}")[^>]*>`, 'i'))?.[0];
  assert.ok(tag, `Expected ${tagName} with ${attribute}="${value}" in built journal route`);
  return tag.match(/\bcontent="([^"]*)"/i)?.[1];
}

test('the built couples-journal direct route has crawler-readable page metadata', () => {
  const escapedTitle = metadata.title.replaceAll('&', '&amp;');
  const escapedDescription = metadata.description.replaceAll('&', '&amp;');
  assert.ok(html.includes(`<title>${escapedTitle}</title>`));
  assert.equal(getAttribute('meta', 'name', 'description'), escapedDescription);
  assert.equal(getAttribute('meta', 'property', 'og:title'), escapedTitle);
  assert.equal(getAttribute('meta', 'property', 'og:description'), escapedDescription);
  assert.equal(getAttribute('meta', 'property', 'og:image'), imageUrl);
  assert.equal(getAttribute('meta', 'property', 'og:url'), canonicalUrl);
  assert.equal(getAttribute('meta', 'name', 'twitter:title'), escapedTitle);
  assert.equal(getAttribute('meta', 'name', 'twitter:description'), escapedDescription);
  assert.equal(getAttribute('meta', 'name', 'twitter:image'), imageUrl);
  assert.match(html, new RegExp(`<link\\s+rel="canonical"\\s+href="${canonicalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module"/);
});
