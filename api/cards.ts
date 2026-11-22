import type { VercelRequest, VercelResponse } from "@vercel/node";
import cards from "../data/n4-cards.json" with { type: "json" };
import { requireAuth, sendJson } from "./_auth.js";

export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }
  if (!requireAuth(req, res)) return;
  sendJson(res, 200, cards);
}
