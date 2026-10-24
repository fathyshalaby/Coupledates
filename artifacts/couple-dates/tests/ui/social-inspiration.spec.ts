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

test('inspiration accepts only Instagram and TikTok links', async ({ page, network }) => {
  await page.route('**/api/preferences', (route) => route.fulfill({ json: preferences }));
  await page.goto('/assistant');
  await page.getByTestId('button-open-inspiration').click();
  await page.getByTestId('input-inspiration-url').fill('https://instagram.com.example.org/reel/not-instagram');
  await page.getByTestId('button-send-inspiration').click();

  await expect(page.getByTestId('state-inspiration-error')).toContainText('Instagram or TikTok');
  expect(network.writes.filter((write) => write.path === '/api/openai/date-assistant')).toHaveLength(0);
});
