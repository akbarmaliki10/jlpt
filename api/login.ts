import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createSessionCookie,
  isAuthConfigured,
  sendJson,
  verifyPassword,
} from "./_auth.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!isAuthConfigured()) {
    sendJson(res, 500, {
      error: "Server auth is not configured (set APP_PASSWORD and AUTH_SECRET).",
    });
    return;
  }

  const password =
    typeof req.body === "string"
      ? (JSON.parse(req.body || "{}") as { password?: string }).password
      : (req.body as { password?: string } | undefined)?.password;

  if (typeof password !== "string" || !verifyPassword(password)) {
    sendJson(res, 401, { error: "Invalid password" });
    return;
  }

  res.setHeader("Set-Cookie", createSessionCookie());
  sendJson(res, 200, { ok: true });
}
