import { trackEvent } from './analytics';

type Status = {
  entitled: boolean;
  verificationPending: boolean;
  checkoutPending: boolean;
  cancelAtPeriodEnd: boolean;
};
type Entry = 'assistant' | 'recap' | 'billing' | 'billing_pending';
const PENDING_KEY = 'couple-dates:upgrade-pending';

// Only a boolean survives the hosted-checkout redirect. No billing or identity
// data is stored or sent. Storage denial is harmless; in-memory tracking remains.
function pendingCheckout(): boolean {
  try { return typeof window !== 'undefined' && window.sessionStorage.getItem(PENDING_KEY) === '1'; }
  catch { return false; }
}
function savePending(pending: boolean): void {
  try {
    if (pending) window.sessionStorage.setItem(PENDING_KEY, '1');
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch { /* Storage must never affect checkout or access. */ }
}

export function trackUpgradeEntry(location: Entry): void {
  trackEvent('upgrade_clicked', { plan: 'plus', location });
}

/** One observer per query client, shared by billing, settings and paid pages. */
export function createBillingAnalytics() {
  let awaitingActivation = pendingCheckout();
  let previousEntitled: boolean | undefined;
  let returnRecorded = false;
  return {
    checkoutCreated(resumed: boolean) {
      awaitingActivation = true;
      savePending(true);
      trackEvent('checkout_created', { plan: 'plus', location: 'billing', resumed });
    },
    checkoutReturned() {
      if (returnRecorded) return;
      returnRecorded = true;
      // A return is not payment proof and does not arm activation tracking.
      trackEvent('checkout_returned', { plan: 'plus', location: 'billing' });
    },
    observe(status: Status) {
      if (status.verificationPending) return;
      if (!status.entitled && status.checkoutPending) {
        awaitingActivation = true;
        savePending(true);
      }
      if (status.entitled && (awaitingActivation || previousEntitled === false)) {
        awaitingActivation = false;
        savePending(false);
        trackEvent('plus_activated', { plan: 'plus' });
      }
      // Repeated polls, rerenders and route changes do not repeat activation.
      // Existing subscribers on their first visit are not new activations.
      previousEntitled = status.entitled;
    },
    renewalConfirmed(action: 'cancel' | 'resume', status: Status) {
      if (status.verificationPending || !status.entitled) return;
      if (action === 'cancel' && status.cancelAtPeriodEnd) {
        trackEvent('renewal_cancelled', { plan: 'plus', location: 'billing' });
      } else if (action === 'resume' && !status.cancelAtPeriodEnd) {
        trackEvent('renewal_resumed', { plan: 'plus', location: 'billing' });
      }
    },
    reset() {
      awaitingActivation = false;
      previousEntitled = undefined;
      returnRecorded = false;
      savePending(false);
    },
  };
}
