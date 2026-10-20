import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createBillingAnalytics, trackUpgradeEntry } from './billing-analytics';
import { trackEvent } from './analytics';

const free = { entitled: false, verificationPending: false, checkoutPending: false, cancelAtPeriodEnd: false };
const plus = { ...free, entitled: true };
let events: { name: string; data: unknown }[];
let storage: Map<string, string>;

beforeEach(() => {
  events = [];
  storage = new Map();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    umami: { track: (name: string, data: unknown) => { events.push({ name, data }); } },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
      removeItem: (key: string) => { storage.delete(key); },
    },
  } });
});
afterEach(() => { Reflect.deleteProperty(globalThis, 'window'); });

test('upgrade sources have only fixed, non-private labels', () => {
  for (const location of ['assistant', 'recap', 'billing', 'billing_pending'] as const) trackUpgradeEntry(location);
  assert.deepEqual(events, ['assistant', 'recap', 'billing', 'billing_pending'].map(location => ({
    name: 'upgrade_clicked', data: { plan: 'plus', location },
  })));
});

test('checkout creation survives redirect; only verified entitlement activates once', () => {
  createBillingAnalytics().checkoutCreated(false);
  const returned = createBillingAnalytics();
  returned.checkoutReturned();
  returned.checkoutReturned();
  returned.observe({ ...plus, verificationPending: true });
  returned.observe({ ...free, checkoutPending: true });
  assert.deepEqual(events.map(e => e.name), ['checkout_created', 'checkout_returned']);
  returned.observe(plus);
  returned.observe(plus);
  returned.observe({ ...plus, verificationPending: true });
  returned.observe(plus);
  createBillingAnalytics().observe(plus);
  assert.deepEqual(events.map(e => e.name), ['checkout_created', 'checkout_returned', 'plus_activated']);
  assert.equal(storage.size, 0);
});

test('a return parameter alone is not an activation and existing Plus is not a new purchase', () => {
  const analytics = createBillingAnalytics();
  analytics.checkoutReturned();
  analytics.observe(plus);
  analytics.observe(plus);
  assert.deepEqual(events.map(e => e.name), ['checkout_returned']);
});

test('free-to-paid transition on any shared status consumer activates once', () => {
  const analytics = createBillingAnalytics();
  analytics.observe(free);
  analytics.observe(plus);
  analytics.observe(plus);
  assert.deepEqual(events, [{ name: 'plus_activated', data: { plan: 'plus' } }]);
});

test('resumed hosted checkout is distinct from resuming renewal', () => {
  createBillingAnalytics().checkoutCreated(true);
  assert.deepEqual(events, [{
    name: 'checkout_created', data: { plan: 'plus', location: 'billing', resumed: true },
  }]);
});

test('renewal outcomes require a verified server response matching the action', () => {
  const analytics = createBillingAnalytics();
  analytics.renewalConfirmed('cancel', plus);
  analytics.renewalConfirmed('resume', { ...plus, cancelAtPeriodEnd: true });
  analytics.renewalConfirmed('cancel', { ...plus, cancelAtPeriodEnd: true, verificationPending: true });
  analytics.renewalConfirmed('resume', free);
  assert.equal(events.length, 0);
  analytics.renewalConfirmed('cancel', { ...plus, cancelAtPeriodEnd: true });
  analytics.renewalConfirmed('resume', plus);
  assert.deepEqual(events.map(e => e.name), ['renewal_cancelled', 'renewal_resumed']);
});

test('reset at an account boundary clears pending activation and prior entitlement', () => {
  const analytics = createBillingAnalytics();
  analytics.checkoutCreated(false);
  analytics.observe(free);
  analytics.reset();
  analytics.observe(plus);
  assert.deepEqual(events.map(e => e.name), ['checkout_created']);
  assert.equal(storage.size, 0);
});

test('missing browser, missing tracker, thrown tracker and rejected tracker are harmless', async () => {
  Reflect.deleteProperty(globalThis, 'window');
  assert.doesNotThrow(() => trackEvent('upgrade_clicked'));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  assert.doesNotThrow(() => trackUpgradeEntry('billing'));
  window.umami = { track: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => createBillingAnalytics().checkoutCreated(false));
  window.umami = { track: () => Promise.reject(new Error('network blocked')) };
  assert.doesNotThrow(() => createBillingAnalytics().checkoutReturned());
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('denied storage and analytics cannot interrupt the subscription lifecycle', () => {
  Object.defineProperty(window, 'sessionStorage', { get: () => { throw new Error('denied'); } });
  window.umami = { track: () => { throw new Error('blocked'); } };
  assert.doesNotThrow(() => {
    const analytics = createBillingAnalytics();
    analytics.checkoutCreated(false);
    analytics.checkoutReturned();
    analytics.observe(free);
    analytics.observe(plus);
    analytics.renewalConfirmed('cancel', { ...plus, cancelAtPeriodEnd: true });
    analytics.renewalConfirmed('resume', plus);
    analytics.reset();
  });
});
