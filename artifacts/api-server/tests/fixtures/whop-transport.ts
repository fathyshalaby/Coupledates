import assert from "node:assert/strict";
import type { Whop } from "@whop/sdk";

export const API_DATE = "2026-10-15-1";
export const SIGNING_KEY = "ws_disposable_contract_signing_key";
export const START = Date.parse("2026-10-20T12:00:00Z");
export const END = "2026-11-19T12:00:00.000Z";
type Member = Pick<Whop.Membership, "id" | "account" | "product_id" | "plan_id" | "user_id" |
  "metadata" | "status" | "cancel_at_period_end" | "current_period_end" | "manage_url">;
type Call = { method: string; path: string; query: URLSearchParams; body: Record<string, any>; headers: Headers };

// These are JSON wire fixtures, not mocked SDK methods. Production's real
// getWhopClient, SDK serializers, and dated request headers remain under test.
export class WhopTransport {
  calls: Call[] = [];
  members = new Map<string, Member>();
  payments = new Map<string, Pick<Whop.Payment, "id" | "membership_id">>();
  retrievals: Member[] = [];
  unavailable = false;
  renewalPrice = 5;
  private serial = 0;
  readonly blocked: string[] = [];
  violations: string[] = [];
  readonly originalFetch = globalThis.fetch;

  install() {
    globalThis.fetch = async (input, init) => {
      try {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
      if (url.hostname === "connector.example.test" && url.pathname === "/api/v2/connection") {
        assert.equal(url.searchParams.get("connector_names"), "whop");
        return json({ items: [{ settings: { api_key: "apik_disposable_contract_only" } }] });
      }
      if (url.origin !== "https://api.whop.com" || !url.pathname.startsWith("/api/v1/")) {
        this.blocked.push(request.url);
        throw new Error(`External network forbidden in billing contracts: ${url.origin}`);
      }
      const call: Call = {
        method: request.method, path: url.pathname.slice("/api/v1".length), query: url.searchParams,
        body: request.method === "GET" ? {} : JSON.parse(await request.text() || "{}"),
        headers: request.headers,
      };
      this.calls.push(call);
      assert.equal(call.headers.get("api-version-date"), API_DATE, "SDK API date drifted");
      assert.equal(call.headers.get("authorization"), "Bearer apik_disposable_contract_only");
      if (this.unavailable) return json({ error: { message: "Fixture outage" } }, 503);
      const { method, path, body } = call;
      if (method === "POST" && path === "/webhooks") {
        assert.equal(body.api_version_date, API_DATE);
        assert.equal(body.account_id, "biz_contract");
        assert.equal(body.url, "https://billing.example.test/api/billing/webhook");
        assert.deepEqual(body.events, ["membership.activated", "membership.deactivated", "membership.updated", "payment.succeeded", "payment.failed"]);
        return json({ id: "hook_contract", webhook_secret: SIGNING_KEY });
      }
      if (method === "GET" && path === "/plans/plan_base") return json({
        id: "plan_base", product: { id: "prod_contract" }, initial_price: 0,
        renewal_price: this.renewalPrice, billing_period: 30, currency: "usd",
      } satisfies Pick<Whop.Plan, "id" | "product" | "initial_price" | "renewal_price" | "billing_period" | "currency">);
      if (method === "POST" && path === "/plans") {
        assert.deepEqual(body, {
          account_id: "biz_contract", product_id: "prod_contract", title: "Couple Dates Plus",
          plan_type: "renewal", initial_price: 0, renewal_price: 5, billing_period: 30,
          currency: "usd", visibility: "hidden", unlimited_stock: false, stock: 1, trial_period_days: 0,
        });
        assert.match(call.headers.get("idempotency-key")!, /^couple-plan-[0-9a-f-]{36}$/);
        return json({ id: `plan_private_${++this.serial}` });
      }
      if (method === "PATCH" && path.startsWith("/plans/")) {
        assert.deepEqual(body, { visibility: "archived" });
        return json({ id: path.split("/").at(-1), visibility: "archived" });
      }
      if (method === "POST" && path === "/checkout_configurations") {
        assert.equal(body.account_id, "biz_contract");
        assert.equal(body.mode, "payment");
        assert.equal(body.redirect_url, "https://billing.example.test/billing?checkout=return");
        assert.match(body.metadata.cd_checkout_id, /^[0-9a-f-]{36}$/);
        assert.equal(call.headers.get("idempotency-key"), `couple-checkout-${body.metadata.cd_checkout_id}`);
        const planCall = this.calls.find(c => c.headers.get("idempotency-key") === `couple-plan-${body.metadata.cd_checkout_id}`);
        assert.ok(planCall, "private offer and checkout must share a reservation");
        return json({ id: `ch_${this.serial}`, purchase_url: `https://whop.com/checkout/contract_${this.serial}` });
      }
      if (method === "GET" && path === "/memberships") {
        assert.equal(call.query.get("account_id"), "biz_contract");
        assert.equal(call.query.get("first"), "10");
        const plans = call.query.getAll("plan_ids");
        assert.equal(plans.length, 1, "list must be scoped to the reserved plan");
        return json({ data: [...this.members.values()].filter(m => plans.includes(m.plan_id)),
          page_info: { has_next_page: false, has_previous_page: false, start_cursor: null, end_cursor: null } });
      }
      const match = path.match(/^\/memberships\/(mem_[^/]+)(?:\/(cancel|resume))?$/);
      if (match) {
        const member = this.members.get(match[1]);
        assert.ok(member, `Unknown fixture membership: ${match[1]}`);
        if (method === "GET" && !match[2]) return json(this.retrievals.shift() ?? member);
        if (method === "POST" && match[2] === "cancel") {
          assert.deepEqual(body, { cancel_at_period_end: true, reason: "Partner requested cancellation in Couple Dates." });
          member.cancel_at_period_end = true;
          member.status = "canceling";
          return json(member);
        }
        if (method === "POST" && match[2] === "resume") {
          member.cancel_at_period_end = false;
          member.status = "active";
          return json(member);
        }
      }
      if (method === "GET" && path.startsWith("/payments/")) {
        const payment = this.payments.get(path.split("/").at(-1)!);
        assert.ok(payment, "Only explicit payment fixtures may be read");
        return json(payment);
      }
      // No fallthrough to originalFetch, even for an unexpected SDK call.
      this.blocked.push(`${method} ${path}`);
      throw new Error(`Unexpected Whop contract call: ${method} ${path}`);
      } catch (error) {
        this.violations.push(error instanceof Error ? error.message : String(error));
        throw error;
      }
    };
  }

  reset() {
    this.calls = []; this.members.clear(); this.payments.clear(); this.retrievals = [];
    this.unavailable = false; this.renewalPrice = 5;
    this.violations = [];
  }

  activate(checkout: { id: string; planId: string | null }, id = `mem_${this.serial}`) {
    const member = {
      id, account: { id: "biz_contract", title: "Contract store", route: "contract-store",
        logo_url: null }, product_id: "prod_contract", plan_id: checkout.planId!,
      user_id: "user_whop_contract", metadata: { cd_checkout_id: checkout.id },
      status: "active", cancel_at_period_end: false, current_period_end: END,
      manage_url: "https://whop.com/orders/contract",
    } satisfies Member;
    this.members.set(id, member);
    return member as Member;
  }
}
