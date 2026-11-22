import type { Card, ProgressStore } from "../types";
import { createEmptyProgressStore, rolloverDailyStats } from "../core/srs";

export interface SessionInfo {
  authenticated: boolean;
  authRequired: boolean;
}

export async function getSession(): Promise<SessionInfo> {
  const res = await fetch("/api/session", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to check session (${res.status})`);
  return (await res.json()) as SessionInfo;
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch("/api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.status === 401) return false;
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Login failed (${res.status})`);
  }
  return true;
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", {
    method: "POST",
    credentials: "same-origin",
  });
}

export async function loadCards(): Promise<Card[]> {
  const res = await fetch("/api/cards", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load cards (${res.status})`);
  return (await res.json()) as Card[];
}

export async function loadProgress(): Promise<ProgressStore> {
  const res = await fetch("/api/progress", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Failed to load progress (${res.status})`);
  const data = (await res.json()) as { store: ProgressStore | null };
  const now = Date.now();
  if (!data.store) return createEmptyProgressStore(now);

  return {
    ...data.store,
    stats: rolloverDailyStats(data.store.stats, now),
  };
}

export async function saveProgress(store: ProgressStore): Promise<void> {
  const res = await fetch("/api/progress", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(store),
  });
  if (!res.ok) throw new Error(`Failed to save progress (${res.status})`);
}
