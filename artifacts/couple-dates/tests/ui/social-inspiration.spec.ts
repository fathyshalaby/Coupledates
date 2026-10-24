import { test, expect } from './fixtures';
import { noHorizontalOverflow } from './assertions';

const preferences = [{
  isYou: true,
  displayName: 'Alex',
  interests: ['food', 'walks'],
  avoid: '',
  budget: 60,
  currency: 'EUR',
  city: 'Vienna',
  timezone: 'Europe/Vienna',
  relationshipMode: 'together',
  availability: [],
  notes: '',
}];

test('social inspiration is shared with the assistant and remains clickable for both partners', async ({ page, network }) => {
  await page.route('**/api/preferences', (route) => route.fulfill({ json: preferences }));
  await page.goto('/assistant');
  await page.getByTestId('button-open-inspiration').click();

  const link = 'https://www.tiktok.com/@dateideas/video/12345';
  const note = 'We both like low-key cooking nights and this setup looks fun.';
  await page.getByTestId('input-inspiration-url').fill(link);
  await page.getByTestId('input-inspiration-note').fill(note);
  await page.getByTestId('button-send-inspiration').click();

  await expect.poll(() => network.writes.filter((write) => write.path === '/api/openai/date-assistant')).toHaveLength(1);
  const request = network.writes.find((write) => write.path === '/api/openai/date-assistant');
  expect(request?.data.message).toContain(link);
  expect(request?.data.message).toContain(note);
  const savedTurn = page.getByTestId('turn-990001');
  await expect(savedTurn).toContainText(note);
  await expect(savedTurn.getByRole('link', { name: link })).toHaveAttribute('href', link);
  await expect(page.getByTestId('input-inspiration-url')).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test('Android share-target links open as a reviewable assistant draft and clear after sending', async ({ page, network }) => {
  await page.route('**/api/preferences', (route) => route.fulfill({ json: preferences }));

  const link = 'https://www.instagram.com/reel/ABC123/';
  const query = new URLSearchParams({
    title: 'A cosy dinner idea',
    text: `Let’s save this for a night in ${link}`,
    url: link,
  });
  await page.goto(`/share?${query.toString()}`);

  await expect(page).toHaveURL(/\/assistant$/);
  await expect(page.getByTestId('button-open-inspiration')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('input-inspiration-url')).toHaveValue(link);
  await expect(page.getByTestId('input-inspiration-note')).toHaveValue(/Let’s save this for a night in/);
  await expect(page.getByTestId('status-shared-inspiration')).toContainText('nothing is sent to your partner');

  await page.getByTestId('button-send-inspiration').click();
  await expect.poll(() => network.writes.filter((write) => write.path === '/api/openai/date-assistant')).toHaveLength(1);
  const request = network.writes.find((write) => write.path === '/api/openai/date-assistant');
  expect(request?.data.message).toContain(link);
  expect(request?.data.message).toContain('Let’s save this for a night in');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('couple-dates:incoming-social-inspiration'))).toBeNull();
});

test('Android share target finds a supported link embedded in shared text', async ({ page }) => {
  const link = 'https://vt.tiktok.com/ZSRabc123/';
  const query = new URLSearchParams({
    title: 'Try this together',
    text: `This looks fun for us: ${link}`,
  });
  await page.goto(`/share?${query.toString()}`);

  await expect(page).toHaveURL(/\/assistant$/);
  await expect(page.getByTestId('input-inspiration-url')).toHaveValue(link);
  await expect(page.getByTestId('input-inspiration-note')).toHaveValue(/This looks fun for us:\s+Try this together/);
});

test('PWA manifest registers the Android share target and install icons', async ({ page }) => {
  const response = await page.request.get('/manifest.webmanifest');
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();

  expect(manifest.display).toBe('standalone');
  expect(manifest.share_target).toEqual({
    action: './share',
    method: 'GET',
    enctype: 'application/x-www-form-urlencoded',
    params: { title: 'title', text: 'text', url: 'url' },
  });
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
    expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
  ]));
});

test('share target rejects links outside Instagram and TikTok', async ({ page, network }) => {
  const query = new URLSearchParams({ url: 'https://example.org/video/123', text: 'Try this date idea' });
  await page.goto(`/share?${query.toString()}`);

  await expect(page.getByRole('heading', { name: 'That share needs a link' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Ideas' })).toHaveAttribute('href', '/assistant');
  expect(network.writes.filter((write) => write.path === '/api/openai/date-assistant')).toHaveLength(0);
});

test('inspiration accepts only Instagram and TikTok links', async ({ page, network }) => {
  await page.route('**/api/preferences', (route) => route.fulfill({ json: preferences }));
  await page.goto('/assistant');
  await page.getByTestId('button-open-inspiration').click();
  await page.getByTestId('input-inspiration-url').fill('https://instagram.com.example.org/reel/not-instagram');
  await page.getByTestId('button-send-inspiration').click();

  await expect(page.getByTestId('state-inspiration-error')).toContainText('Instagram or TikTok');
  expect(network.writes.filter((write) => write.path === '/api/openai/date-assistant')).toHaveLength(0);
});
