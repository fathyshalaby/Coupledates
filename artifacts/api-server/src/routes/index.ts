import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coupleRouter from "./couple";
import memoriesRouter from "./memories";
import datesRouter from "./dates";
import activityRouter from "./activity";
import storageRouter from "./storage";
import preferencesRouter from "./preferences";
import dateActionsRouter from "./date-actions";
import dateAssistantRouter from "./date-assistant";
import calendarRouter from "./calendar";
import dateCalendarRouter from "./date-calendar";
import billingRouter from "./billing";
import remindersRouter from "./reminders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coupleRouter);
router.use(memoriesRouter);
router.use(datesRouter);
router.use(activityRouter);
router.use(storageRouter);
router.use(preferencesRouter);
router.use(dateActionsRouter);
router.use(dateAssistantRouter);
router.use(calendarRouter);
router.use(dateCalendarRouter);
router.use(billingRouter);
router.use(remindersRouter);

export default router;
