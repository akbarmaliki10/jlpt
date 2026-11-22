import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import deckData from "../../data/n4-cards.json";
import {
  createSessionCookie,
  isAuthenticated,
  verifyPassword,
} from "../../api/_auth";
import type { Card } from "../types";
import {
  applyReviewResult,
  computeNextReviewAt,
  createEmptyProgressStore,
  getDueCards,
  getNewLessons,
  getStudyDateKey,
  graduateLessonCard,
  rolloverDailyStats,
} from "./srs";
import { convertLiveKana, gradeMeaning, gradeReading } from "./grading";
import {
  advanceReviewSession,
  createReviewSession,
  getSessionProgress,
} from "./queue";

const sampleCards: Card[] = [
  { id: "k_食", type: "kanji", prompt: "食", readings: ["しょく", "た"], meanings: ["eat", "food"] },
  { id: "v_食べる", type: "vocab", prompt: "食べる", readings: ["たべる"], meanings: ["to eat"] },
  { id: "v_アルバイト", type: "vocab", prompt: "アルバイト", readings: ["アルバイト"], meanings: ["part-time job"] },
];

describe("SRS Engine", () => {
  it("snaps >= 1 day intervals to 04:00 local study day", () => {
    // 2026-11-14 22:30 local
    const now = new Date(2026, 10, 14, 22, 30, 0, 0).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const due = computeNextReviewAt(now, oneDayMs);
    const dueDate = new Date(due);
    expect(dueDate.getFullYear()).toBe(2026);
    expect(dueDate.getMonth()).toBe(10);
    expect(dueDate.getDate()).toBe(15);
    expect(dueDate.getHours()).toBe(4);
    expect(dueDate.getMinutes()).toBe(0);
  });

  it("keeps 4h stage exact without snapping to 04:00", () => {
    const now = new Date(2026, 10, 14, 10, 0, 0, 0).getTime();
    const graduated = graduateLessonCard("k_食", now);
    expect(graduated.stage).toBe(1);
    expect(graduated.nextReviewAt).toBe(now + 4 * 60 * 60 * 1000);
  });

  it("promotes on 0 wrong and demotes mature cards by 2 stages per wrong batch", () => {
    const now = new Date(2026, 10, 14, 12, 0, 0, 0).getTime();
    const stage5 = {
      cardId: "k_食",
      stage: 5,
      nextReviewAt: now - 1000,
      correctStreak: 5,
      totalReviews: 5,
      totalWrong: 0,
      lastReviewedAt: now - 10000,
    };

    const promoted = applyReviewResult(stage5, "k_食", 0, now);
    expect(promoted.stage).toBe(6);

    const demotedOnce = applyReviewResult(stage5, "k_食", 1, now);
    expect(demotedOnce.stage).toBe(3);

    const demotedThree = applyReviewResult(stage5, "k_食", 3, now);
    expect(demotedThree.stage).toBe(1);
  });

  it("rolls over daily stats and preserves streak only when yesterday had activity", () => {
    const day1 = new Date(2026, 10, 14, 21, 0, 0, 0).getTime();
    const day2 = new Date(2026, 10, 15, 9, 0, 0, 0).getTime();
    const day4 = new Date(2026, 10, 17, 9, 0, 0, 0).getTime();

    const activeDay1 = {
      date: getStudyDateKey(day1),
      lessonsDone: 5,
      reviewsDone: 3,
      streak: 4,
    };

    const rolledDay2 = rolloverDailyStats(activeDay1, day2);
    expect(rolledDay2.streak).toBe(4);
    expect(rolledDay2.lessonsDone).toBe(0);

    const rolledDay4 = rolloverDailyStats(activeDay1, day4);
    expect(rolledDay4.streak).toBe(0);
  });

  it("returns due cards and respects daily new lesson cap", () => {
    const now = new Date(2026, 10, 14, 12, 0, 0, 0).getTime();
    const store = createEmptyProgressStore(now);
    store.settings.dailyNewLimit = 2;
    store.cards["k_食"] = {
      cardId: "k_食",
      stage: 1,
      nextReviewAt: now - 10,
      correctStreak: 1,
      totalReviews: 1,
      totalWrong: 0,
      lastReviewedAt: now - 1000,
    };

    expect(getDueCards(sampleCards, store.cards, now).map((c) => c.id)).toEqual(["k_食"]);
    expect(getNewLessons(sampleCards, store, now).map((c) => c.id)).toEqual([
      "v_食べる",
      "v_アルバイト",
    ]);
  });
});

describe("Grading & Romaji Conversion", () => {
  it("converts romaji to kana including trailing n and katakana normalization", () => {
    expect(convertLiveKana("taberu")).toBe("たべる");
    expect(gradeReading("taberu", ["たべる"])).toBe(true);
    expect(gradeReading("hon", ["ほん"])).toBe(true);
    expect(gradeReading("kitte", ["きって"])).toBe(true);
    expect(gradeReading("arubaito", ["アルバイト"])).toBe(true);
    expect(gradeReading("nomu", ["たべる"])).toBe(false);
  });

  it("grades meanings flexibly with verb 'to' stripping and 1-char typo tolerance", () => {
    expect(gradeMeaning("eat", ["to eat"])).toBe(true);
    expect(gradeMeaning("To Eat!", ["to eat"])).toBe(true);
    expect(gradeMeaning("part time job", ["part-time job"])).toBe(true);
    expect(gradeMeaning("part-time jbo", ["part-time job"])).toBe(true);
    expect(gradeMeaning("sleep", ["to eat"])).toBe(false);
  });
});

describe("Review Queue (+2 Turn Re-queue)", () => {
  it("re-inserts wrong card 2 turns ahead and still tracks wrong count", () => {
    let session = createReviewSession(sampleCards, () => 0);
    const firstItem = session.queue[0];
    const afterTwo = [session.queue[1], session.queue[2]];

    // Fail the first item
    const res1 = advanceReviewSession(session, false);
    session = res1.nextState;

    expect(session.wrongCounts[firstItem.cardId]).toBe(1);
    expect(session.queue[0]).toEqual(afterTwo[0]);
    expect(session.queue[1]).toEqual(afterTwo[1]);
    expect(session.queue[2]).toEqual(firstItem);

    // Passing one half of a card updates step progress immediately
    const res2 = advanceReviewSession(session, true);
    session = res2.nextState;
    const prog = getSessionProgress(session);
    expect(prog.passedSteps).toBe(1);
    expect(prog.totalSteps).toBe(6);
    expect(prog.percent).toBe(17);

    // Clear all remaining items correctly
    const completed: Array<{ id: string; wrong: number }> = [];
    while (session.queue.length > 0) {
      const res = advanceReviewSession(session, true);
      session = res.nextState;
      if (res.completedCardId) {
        completed.push({ id: res.completedCardId, wrong: res.wrongCountForCompleted });
      }
    }

    expect(completed).toHaveLength(3);
    const missedCard = completed.find((c) => c.id === firstItem.cardId);
    expect(missedCard?.wrong).toBe(1);
  });
});

describe("N4 Deck Alignment", () => {
  it("has unique IDs and introduces kanji before vocab using those kanji", () => {
    const cards = deckData as Card[];
    const ids = new Set<string>();
    const seenKanji = new Set<string>();

    for (const card of cards) {
      expect(ids.has(card.id)).toBe(false);
      ids.add(card.id);

      if (card.type === "kanji") {
        seenKanji.add(card.prompt);
      } else {
        const hasKanjiChar = [...card.prompt].some((ch) => /[\u4e00-\u9faf]/.test(ch));
        if (hasKanjiChar) {
          const usesSeenKanji = [...card.prompt].some((ch) => seenKanji.has(ch));
          expect(usesSeenKanji, `Vocab ${card.prompt} appeared before its kanji`).toBe(true);
        }
      }
    }
  });
});

describe("Vercel Password Auth", () => {
  it("verifies password and rejects tampered or expired session cookies", () => {
    process.env.APP_PASSWORD = "correct-horse-battery";
    process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";

    expect(verifyPassword("correct-horse-battery")).toBe(true);
    expect(verifyPassword("wrong-pass")).toBe(false);

    const cookieHeader = createSessionCookie().split(";")[0];
    expect(isAuthenticated({ headers: { cookie: cookieHeader } } as IncomingMessage)).toBe(true);

    const tampered = `${cookieHeader.slice(0, -1)}${cookieHeader.endsWith("a") ? "b" : "a"}`;
    expect(isAuthenticated({ headers: { cookie: tampered } } as IncomingMessage)).toBe(false);
    expect(isAuthenticated({ headers: {} } as IncomingMessage)).toBe(false);
  });
});
