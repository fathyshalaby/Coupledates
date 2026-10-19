import { db, uploadsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { fail } from "./couple";

export const storage = new ObjectStorageService();
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
export async function ownedPhoto(path: string, coupleId: number) {
  if (!/^\/objects\/uploads\/[a-f0-9-]{36}$/.test(path)) fail(400, "Invalid photo path.");
  const [upload] = await db.select().from(uploadsTable)
    .where(and(eq(uploadsTable.objectPath, path), eq(uploadsTable.coupleId, coupleId)));
  if (!upload) fail(404, "Photo not found in your space.");
  const file = await storage.getObjectEntityFile(path);
  const [meta] = await file.getMetadata();
  if (!allowedTypes.has(String(meta.contentType)) || Number(meta.size) > 10485760 || Number(meta.size) < 1) {
    fail(400, "Upload an image up to 10 MB.");
  }
  return { file, meta };
}
