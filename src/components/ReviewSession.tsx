import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "../types";
import {
  advanceReviewSession,
  createReviewSession,
  getSessionProgress,
  type SessionState,
} from "../core/queue";
import { getStageInfo } from "../core/srs";
import { playCelebrationSound } from "../core/sound";
import { Confetti } from "./Confetti";
import { QuizPrompt, type FeedbackMeta } from "./QuizPrompt";

interface ReviewSessionProps {
  cards: Card[];
  onCardCompleted: (
    cardId: string,
    wrongCount: number
  ) => { prevStage: number; nextStage: number };
  onExit: () => void;
}

export function ReviewSession({
  cards,
  onCardCompleted,
  onExit,
}: ReviewSessionProps) {
  const cardById = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c])),
    [cards]
  );
  const [session, setSession] = useState<SessionState>(() =>
    createReviewSession(cards)
  );
  const [previewState, setPreviewState] = useState<SessionState | null>(null);
  const [turn, setTurn] = useState(0);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const pendingNextRef = useRef<SessionState | null>(null);

  const currentItem = session.queue[0];
  const currentCard = currentItem ? cardById[currentItem.cardId] : undefined;
  const isComplete = !currentItem || !currentCard;

  useEffect(() => {
    if (isComplete) playCelebrationSound();
  }, [isComplete]);

  const handleAnswer = (isCorrect: boolean): FeedbackMeta | void => {
    const res = advanceReviewSession(session, isCorrect);
    pendingNextRef.current = res.nextState;
    setPreviewState(res.nextState);

    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      wrong: prev.wrong + (isCorrect ? 0 : 1),
    }));

    if (res.completedCardId) {
      const { prevStage, nextStage } = onCardCompleted(
        res.completedCardId,
        res.wrongCountForCompleted
      );
      const fromLabel = getStageInfo(prevStage).label;
      const toLabel = getStageInfo(nextStage).label;
      return {
        badge: `${fromLabel} → ${toLabel}`,
        tone: nextStage >= prevStage ? "green" : "amber",
      };
    }

    if (!isCorrect) {
      return {
        badge:
          res.nextState.queue.length > 2
            ? "Re-queued (+2 turns)"
            : "Re-queued (end of queue)",
        tone: "amber",
      };
    }
  };

  const handleAdvance = () => {
    if (!pendingNextRef.current) return;
    setSession(pendingNextRef.current);
    pendingNextRef.current = null;
    setPreviewState(null);
    setTurn((t) => t + 1);
  };

  if (!currentItem || !currentCard) {
    const total = stats.correct + stats.wrong;
    const accuracy = total > 0 ? Math.round((stats.correct / total) * 100) : 100;
    return (
      <div className="panel celebration-panel">
        <Confetti />
        <div className="celebration-badge">🎉</div>
        <h2 style={{ marginTop: 8 }}>Hooray! Review Complete!</h2>
        <p className="muted">
          Completed {session.completedCardIds.length} cards · Accuracy {accuracy}%
        </p>
        <button
          className="btn btn-primary"
          onClick={onExit}
          style={{ marginTop: 14 }}
        >
          Continue
        </button>
      </div>
    );
  }

  const progress = getSessionProgress(previewState ?? session);

  return (
    <div className="session-wrap">
      <div className="topbar">
        <button className="btn" onClick={onExit}>
          ← Dashboard
        </button>
        <span className="muted">
          Progress: {progress.passedSteps}/{progress.totalSteps} · Cards:{" "}
          {progress.completedCards}/{progress.totalCards} · Queue:{" "}
          {session.queue.length}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      <QuizPrompt
        card={currentCard}
        kind={currentItem.kind}
        itemKey={`${turn}-${currentItem.cardId}-${currentItem.kind}`}
        onSubmitAnswer={handleAnswer}
        onAdvance={handleAdvance}
      />
    </div>
  );
}
