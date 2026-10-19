import { Router, type IRouter } from "express";
import {
  GetBillingStatusResponse, RefreshBillingResponse, CreateBillingCheckoutResponse,
  ManageBillingResponse, CancelBillingResponse, ResumeBillingResponse,
} from "@workspace/api-zod";
import { requireUser, requireCouple, fail } from "../lib/couple";
import { billingConfig, billingStatus, createCheckout, manageSubscription } from "../lib/billing";

const router: IRouter = Router();
router.use("/billing", requireUser, requireCouple);
router.use("/billing", (req, _res, next) => {
  if (req.method !== "GET" && req.get("origin") !== billingConfig().origin) fail(403, "Open billing in this app to make changes.");
  next();
});
router.get("/billing/status", async (_req, res): Promise<void> => {
  res.json(GetBillingStatusResponse.parse(await billingStatus(res.locals.couple.id, res.locals.userId)));
});
router.post("/billing/refresh", async (_req, res): Promise<void> => {
  res.json(RefreshBillingResponse.parse(await billingStatus(res.locals.couple.id, res.locals.userId, true)));
});
router.post("/billing/checkout", async (_req, res): Promise<void> => {
  res.json(CreateBillingCheckoutResponse.parse(await createCheckout(res.locals.couple.id, res.locals.userId)));
});
router.post("/billing/manage", async (_req, res): Promise<void> => {
  res.json(ManageBillingResponse.parse(await manageSubscription(res.locals.couple.id, res.locals.userId, "manage")));
});
router.post("/billing/cancel", async (_req, res): Promise<void> => {
  await manageSubscription(res.locals.couple.id, res.locals.userId, "cancel");
  res.json(CancelBillingResponse.parse(await billingStatus(res.locals.couple.id, res.locals.userId)));
});
router.post("/billing/resume", async (_req, res): Promise<void> => {
  await manageSubscription(res.locals.couple.id, res.locals.userId, "resume");
  res.json(ResumeBillingResponse.parse(await billingStatus(res.locals.couple.id, res.locals.userId)));
});
export default router;
