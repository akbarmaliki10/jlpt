import type { Card, CardProgress, DailyStats, ProgressStore } from "../types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STUDY_DAY_START_HOUR = 4;

export interface SrsStageInfo {
  stage: number;
  label: string;
  bucket: "new" | "learning" | "familiar" | "strong" | "master" | "burned";
  intervalMs: number;
}

export const SRS_STAGES: readonly SrsStageInfo[] = [
  { stage: 0, label: "New", bucket: "new", intervalMs: 0 },
  { stage: 1, label: "Learning 1", bucket: "learning", intervalMs: 4 * HOUR_MS },
  { stage: 2, label: "Learning 2", bucket: "learning", intervalMs: 1 * DAY_MS },
  { stage: 3, label: "Learning 3", bucket: "learning", intervalMs: 3 * DAY_MS },
  { stage: 4, label: "Familiar", bucket: "familiar", intervalMs: 7 * DAY_MS },
  { stage: 5, label: "Strong", bucket: "strong", intervalMs: 14 * DAY_MS },
  { stage: 6, label: "Master", bucket: "master", intervalMs: 30 * DAY_MS },
  { stage: 7, label: "Enlightened", bucket: "master", intervalMs: 90 * DAY_MS },
  { stage: 8, label: "Burned", bucket: "burned", intervalMs: Number.MAX_SAFE_INTEGER },
];

export const MAX_STAGE = 8;

export function getStageInfo(stage: number): SrsStageInfo {
  const clamped = Math.max(0, Math.min(MAX_STAGE, stage));
  return SRS_STAGES[clamped];
}

/** Study day starts at 04:00 local time so late-night reviews count as the same study day. */
export function getStudyDateKey(nowMs: number): string {
  const shifted = new Date(nowMs - STUDY_DAY_START_HOUR * HOUR_MS);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousStudyDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const py = dt.getFullYear();
  const pm = String(dt.getMonth() + 1).padStart(2, "0");
  const pd = String(dt.getDate()).padStart(2, "0");
  return `${py}-${pm}-${pd}`;
}

/**
 * For intervals >= 1 day, snap due timestamp to 04:00 local time of that target study day
 * so studying earlier the next day still makes the card due.
 */
export function computeNextReviewAt(nowMs: number, intervalMs: number): number {
  if (intervalMs >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  const rawTarget = nowMs + intervalMs;
  if (intervalMs < DAY_MS) return rawTarget;

  const studyKey = getStudyDateKey(rawTarget);
  const [y, m, d] = studyKey.split("-").map(Number);
  return new Date(y, m - 1, d, STUDY_DAY_START_HOUR, 0, 0, 0).getTime();
}

export function createEmptyProgressStore(nowMs = Date.now()): ProgressStore {
  return {
    version: 1,
    cards: {},
    stats: {
      date: getStudyDateKey(nowMs),
      lessonsDone: 0,
      reviewsDone: 0,
      streak: 0,
    },
    settings: {
      dailyNewLimit: 10,
      theme: "light",
    },
  };
}

export function rolloverDailyStats(stats: DailyStats, nowMs: number): DailyStats {
  const today = getStudyDateKey(nowMs);
  if (stats.date === today) return stats;

  const yesterday = getPreviousStudyDateKey(today);
  const hadActivityYesterday =
    stats.date === yesterday && (stats.lessonsDone > 0 || stats.reviewsDone > 0);

  return {
    date: today,
    lessonsDone: 0,
    reviewsDone: 0,
    streak: hadActivityYesterday ? stats.streak : 0,
  };
}

export function recordActivityStreak(stats: DailyStats, nowMs: number): DailyStats {
  const rolled = rolloverDailyStats(stats, nowMs);
  const hadActivityToday = rolled.lessonsDone > 0 || rolled.reviewsDone > 0;
  return {
    ...rolled,
    streak: hadActivityToday ? rolled.streak : rolled.streak + 1,
  };
}

export function applyReviewResult(
  existing: CardProgress | undefined,
  cardId: string,
  sessionWrongCount: number,
  nowMs: number
): CardProgress {
  const prevStage = existing?.stage ?? 1;
  let nextStage: number;

  if (sessionWrongCount === 0) {
    nextStage = Math.min(MAX_STAGE, prevStage + 1);
  } else {
    const penaltyFactor = prevStage >= 4 ? 2 : 1;
    const drop = Math.ceil(sessionWrongCount / 2) * penaltyFactor;
    nextStage = Math.max(1, prevStage - drop);
  }

  const { intervalMs } = getStageInfo(nextStage);
  return {
    cardId,
    stage: nextStage,
    nextReviewAt:
      nextStage >= MAX_STAGE ? Number.MAX_SAFE_INTEGER : computeNextReviewAt(nowMs, intervalMs),
    correctStreak: sessionWrongCount === 0 ? (existing?.correctStreak ?? 0) + 1 : 0,
    totalReviews: (existing?.totalReviews ?? 0) + 1,
    totalWrong: (existing?.totalWrong ?? 0) + sessionWrongCount,
    lastReviewedAt: nowMs,
  };
}

export function graduateLessonCard(cardId: string, nowMs: number): CardProgress {
  const { intervalMs } = getStageInfo(1);
  return {
    cardId,
    stage: 1,
    nextReviewAt: computeNextReviewAt(nowMs, intervalMs),
    correctStreak: 1,
    totalReviews: 1,
    totalWrong: 0,
    lastReviewedAt: nowMs,
  };
}

export function isCardDue(progress: CardProgress | undefined, nowMs: number): boolean {
  if (!progress) return false;
  if (progress.stage < 1 || progress.stage >= MAX_STAGE) return false;
  return progress.nextReviewAt <= nowMs;
}

export function isLeech(progress: CardProgress | undefined): boolean {
  if (!progress) return false;
  return progress.totalWrong >= 5 && progress.stage < 4;
}

export function getDueCards(
  cards: Card[],
  progressMap: Record<string, CardProgress>,
  nowMs: number
): Card[] {
  return cards
    .filter((card) => isCardDue(progressMap[card.id], nowMs))
    .sort((a, b) => (progressMap[a.id]?.nextReviewAt ?? 0) - (progressMap[b.id]?.nextReviewAt ?? 0));
}

export function getNewLessons(
  cards: Card[],
  store: ProgressStore,
  nowMs: number
): Card[] {
  const stats = rolloverDailyStats(store.stats, nowMs);
  const remainingToday = Math.max(0, store.settings.dailyNewLimit - stats.lessonsDone);
  if (remainingToday === 0) return [];

  return cards.filter((card) => !store.cards[card.id]).slice(0, remainingToday);
}
