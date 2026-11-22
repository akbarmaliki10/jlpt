import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearSessionCookie, sendJson } from "./_auth.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  res.setHeader("Set-Cookie", clearSessionCookie());
  sendJson(res, 200, { ok: true });
}
