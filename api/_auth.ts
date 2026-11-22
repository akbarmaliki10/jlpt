import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE_NAME = "jlpt_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

function sha256(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(crypto.createHash("sha256").update(value, "utf8").digest());
}

export function isAuthConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD && process.env.AUTH_SECRET);
}

export function verifyPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  return crypto.timingSafeEqual(sha256(candidate), sha256(expected));
}

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionCookie(): string {
  const exp = String(Date.now() + SESSION_TTL_SEC * 1000);
  const sig = sign(exp);
  const secure = process.env.VERCEL === "1" ? "; Secure" : "";
  return `${COOKIE_NAME}=${exp}.${sig}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_SEC}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.VERCEL === "1" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function isAuthenticated(req: IncomingMessage): boolean {
  if (!isAuthConfigured()) return false;
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return false;

  const [expStr, sig] = raw.split(".");
  if (!expStr || !sig) return false;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const expectedSig = sign(expStr);
  if (sig.length !== expectedSig.length) return false;
  return crypto.timingSafeEqual(
    new TextEncoder().encode(sig),
    new TextEncoder().encode(expectedSig)
  );
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!isAuthConfigured()) {
    sendJson(res, 500, { error: "Server auth is not configured (set APP_PASSWORD and AUTH_SECRET)." });
    return false;
  }
  if (!isAuthenticated(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}
