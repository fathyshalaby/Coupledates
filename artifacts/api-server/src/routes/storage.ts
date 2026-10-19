import { Router, type IRouter } from "express";
import { db, uploadsTable } from "@workspace/db";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { requireUser, requireCouple } from "../lib/couple";
import { ownedPhoto, storage } from "../lib/uploads";

const router: IRouter = Router();
router.use("/storage", requireUser, requireCouple);
router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const data = RequestUploadUrlBody.parse(req.body);
  const uploadURL = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadURL);
  await db.insert(uploadsTable).values({ objectPath, coupleId: res.locals.couple.id, userId: res.locals.userId, contentType: data.contentType, size: data.size });
  res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
});
router.get("/storage/objects/{*path}", async (req, res): Promise<void> => {
  const raw = req.params.path;
  const path = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
  const { file, meta } = await ownedPhoto(path, res.locals.couple.id);
  res.setHeader("Content-Type", String(meta.contentType));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  file.createReadStream().on("error", err => {
    req.log.error({ err }, "Photo stream failed");
    if (!res.headersSent) res.status(404).end(); else res.destroy();
  }).pipe(res);
});
export default router;
