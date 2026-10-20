// Vercel serverless function: every /api/* request is rewritten here (see vercel.json)
// and handled by the Express app. The bundle is produced by the build command:
//   pnpm --filter @workspace/api-server run build:vercel
import app from "../artifacts/api-server/dist/vercel.mjs";

export default app;
