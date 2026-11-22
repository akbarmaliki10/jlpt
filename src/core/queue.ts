import type { Card, QueueItem } from "../types";

export interface SessionState {
  queue: QueueItem[];
  passed: Record<string, { reading: boolean; meaning: boolean }>;
  wrongCounts: Record<string, number>;
  completedCardIds: string[];
  totalCards: number;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createReviewSession(
  cards: Card[],
  rng: () => number = Math.random
): SessionState {
  const readingItems: QueueItem[] = cards.map((c) => ({ cardId: c.id, kind: "reading" }));
  const meaningItems: QueueItem[] = cards.map((c) => ({ cardId: c.id, kind: "meaning" }));

  // Interleave shuffled readings and meanings so both prompts for the same card are spaced apart.
  const shuffledR = shuffle(readingItems, rng);
  const shuffledM = shuffle(meaningItems, rng);
  const queue: QueueItem[] = [];
  for (let i = 0; i < cards.length; i++) {
    queue.push(shuffledR[i], shuffledM[i]);
  }

  const passed: SessionState["passed"] = {};
  const wrongCounts: Record<string, number> = {};
  for (const c of cards) {
    passed[c.id] = { reading: false, meaning: false };
    wrongCounts[c.id] = 0;
  }

  return {
    queue,
    passed,
    wrongCounts,
    completedCardIds: [],
    totalCards: cards.length,
  };
}

export interface AdvanceResult {
  nextState: SessionState;
  completedCardId: string | null;
  wrongCountForCompleted: number;
}

/**
 * Processes an answer for queue[0].
 * - Correct: marks that kind passed; if both reading & meaning passed, marks card completed.
 * - Wrong: increments wrongCounts[cardId] and re-inserts the prompt 2 turns later.
 */
export function advanceReviewSession(state: SessionState, isCorrect: boolean): AdvanceResult {
  const [current, ...rest] = state.queue;
  if (!current) {
    return { nextState: state, completedCardId: null, wrongCountForCompleted: 0 };
  }

  if (isCorrect) {
    const prevFlags = state.passed[current.cardId] ?? { reading: false, meaning: false };
    const nextFlags = { ...prevFlags, [current.kind]: true };
    const isCardFinished = nextFlags.reading && nextFlags.meaning;

    return {
      nextState: {
        ...state,
        queue: rest,
        passed: { ...state.passed, [current.cardId]: nextFlags },
        completedCardIds: isCardFinished
          ? [...state.completedCardIds, current.cardId]
          : state.completedCardIds,
      },
      completedCardId: isCardFinished ? current.cardId : null,
      wrongCountForCompleted: isCardFinished ? (state.wrongCounts[current.cardId] ?? 0) : 0,
    };
  }

  // Wrong: re-insert 2 turns later (after next 2 items, or end if fewer than 2 remain).
  const insertAt = Math.min(2, rest.length);
  const nextQueue = [...rest.slice(0, insertAt), current, ...rest.slice(insertAt)];

  return {
    nextState: {
      ...state,
      queue: nextQueue,
      wrongCounts: {
        ...state.wrongCounts,
        [current.cardId]: (state.wrongCounts[current.cardId] ?? 0) + 1,
      },
    },
    completedCardId: null,
    wrongCountForCompleted: 0,
  };
}

export function getSessionProgress(state: SessionState) {
  const totalSteps = state.totalCards * 2;
  let passedSteps = 0;
  for (const flags of Object.values(state.passed)) {
    if (flags.reading) passedSteps += 1;
    if (flags.meaning) passedSteps += 1;
  }
  const percent = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 100;
  return {
    passedSteps,
    totalSteps,
    completedCards: state.completedCardIds.length,
    totalCards: state.totalCards,
    percent,
  };
}
