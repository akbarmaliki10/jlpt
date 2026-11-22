import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthenticated, sendJson } from "./_auth.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  sendJson(res, 200, {
    authenticated: isAuthenticated(req),
    authRequired: true,
  });
}
