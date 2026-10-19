import { Router, type IRouter } from "express";
import healthRouter from "./health";
import coupleRouter from "./couple";
import memoriesRouter from "./memories";
import datesRouter from "./dates";
import activityRouter from "./activity";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(coupleRouter);
router.use(memoriesRouter);
router.use(datesRouter);
router.use(activityRouter);
router.use(storageRouter);

export default router;
