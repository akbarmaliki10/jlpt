import type { VercelRequest, VercelResponse } from "@vercel/node";
import { get, put } from "@vercel/blob";
import { requireAuth, sendJson } from "./_auth.js";

const BLOB_PATH = "jlpt-n4/progress.json";
const BLOB_ACCESS =
  process.env.BLOB_ACCESS === "public" ? "public" : "private";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    try {
      const result = await get(BLOB_PATH, {
        access: BLOB_ACCESS,
        useCache: false,
      });
      if (!result || result.statusCode !== 200) {
        sendJson(res, 200, { store: null });
        return;
      }
      const raw = await new Response(result.stream).text();
      sendJson(res, 200, { store: JSON.parse(raw) });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read blob";
      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const parsed =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!parsed || parsed.version !== 1 || typeof parsed.cards !== "object") {
        sendJson(res, 400, { error: "Invalid progress payload" });
        return;
      }

      await put(BLOB_PATH, JSON.stringify(parsed, null, 2), {
        access: BLOB_ACCESS,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      sendJson(res, 200, { ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to write blob";
      sendJson(res, 500, { error: message });
    }
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
}
