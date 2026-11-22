import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "../types";
import {
  advanceReviewSession,
  createReviewSession,
  getSessionProgress,
  type SessionState,
} from "../core/queue";
import { playCelebrationSound } from "../core/sound";
import { Confetti } from "./Confetti";
import { QuizPrompt, type FeedbackMeta } from "./QuizPrompt";
import { SpeakButton } from "./SpeakButton";

interface LessonSessionProps {
  cards: Card[];
  onCardGraduated: (cardId: string) => void;
  onExit: () => void;
}

export function LessonSession({
  cards,
  onCardGraduated,
  onExit,
}: LessonSessionProps) {
  const batch = useMemo(() => cards.slice(0, 5), [cards]);
  const cardById = useMemo(
    () => Object.fromEntries(batch.map((c) => [c.id, c])),
    [batch]
  );

  const [phase, setPhase] = useState<"study" | "quiz">("study");
  const [studyIdx, setStudyIdx] = useState(0);
  const [session, setSession] = useState<SessionState>(() =>
    createReviewSession(batch)
  );
  const [previewState, setPreviewState] = useState<SessionState | null>(null);
  const [turn, setTurn] = useState(0);
  const pendingNextRef = useRef<SessionState | null>(null);

  const currentItem = session.queue[0];
  const currentCard = currentItem ? cardById[currentItem.cardId] : undefined;
  const isLessonComplete = phase === "quiz" && (!currentItem || !currentCard);

  useEffect(() => {
    if (isLessonComplete) playCelebrationSound();
  }, [isLessonComplete]);

  if (batch.length === 0) {
    return (
      <div className="panel" style={{ textAlign: "center" }}>
        <p>No new lessons available for today.</p>
        <button className="btn btn-primary" onClick={onExit}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (phase === "study") {
    const card = batch[studyIdx];
    return (
      <div className="session-wrap">
        <div className="topbar">
          <button className="btn" onClick={onExit}>
            ← Dashboard
          </button>
          <span className="muted">
            Lesson {studyIdx + 1} of {batch.length}
          </span>
        </div>

        <div className="lesson-tabs">
          {batch.map((c, i) => (
            <button
              key={c.id}
              className={`lesson-tab ${i === studyIdx ? "active" : ""}`}
              onClick={() => setStudyIdx(i)}
            >
              {c.prompt}
            </button>
          ))}
        </div>

        <div key={card.id} className={`card-stage ${card.type}`}>
          <span className="card-type-chip">
            New {card.type === "kanji" ? "Kanji" : "Vocabulary"}
          </span>
          <h1 className="card-prompt">{card.prompt}</h1>
          <div className="prompt-question">{card.meanings.join(", ")}</div>
        </div>

        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>Reading:</strong> {card.readings.join(" / ")}
              {card.readingHint && (
                <span className="muted"> ({card.readingHint})</span>
              )}
            </div>
            <SpeakButton text={card.readings[0]} />
          </div>
          {card.notes && (
            <div className="muted" style={{ marginTop: 8 }}>
              {card.notes}
            </div>
          )}
        </div>

        <div className="topbar">
          <button
            className="btn"
            disabled={studyIdx === 0}
            onClick={() => setStudyIdx((i) => Math.max(0, i - 1))}
          >
            ← Previous
          </button>
          {studyIdx < batch.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStudyIdx((i) => i + 1)}
            >
              Next Card →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setPhase("quiz")}
            >
              Start Quick Quiz →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentItem || !currentCard) {
    return (
      <div className="panel celebration-panel">
        <Confetti />
        <div className="celebration-badge">🎉</div>
        <h2 style={{ marginTop: 8 }}>Hooray! Lesson Complete!</h2>
        <p className="muted">
          {batch.length} new cards unlocked in your SRS queue (first review in 4 hours).
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

  const handleAnswer = (isCorrect: boolean): FeedbackMeta | void => {
    const res = advanceReviewSession(session, isCorrect);
    pendingNextRef.current = res.nextState;
    setPreviewState(res.nextState);

    if (res.completedCardId) {
      onCardGraduated(res.completedCardId);
      return { badge: "Unlocked → Learning 1 (4h)", tone: "green" };
    }
    if (!isCorrect) {
      return { badge: "Re-queued (+2 turns)", tone: "amber" };
    }
  };

  const handleAdvance = () => {
    if (!pendingNextRef.current) return;
    setSession(pendingNextRef.current);
    pendingNextRef.current = null;
    setPreviewState(null);
    setTurn((t) => t + 1);
  };

  const progress = getSessionProgress(previewState ?? session);

  return (
    <div className="session-wrap">
      <div className="topbar">
        <button className="btn" onClick={() => setPhase("study")}>
          ← Review Notes
        </button>
        <span className="muted">
          Lesson Quiz: {progress.passedSteps}/{progress.totalSteps} (
          {progress.completedCards}/{progress.totalCards} cards)
        </span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <QuizPrompt
        card={currentCard}
        kind={currentItem.kind}
        itemKey={`lesson-${turn}-${currentItem.cardId}-${currentItem.kind}`}
        onSubmitAnswer={handleAnswer}
        onAdvance={handleAdvance}
      />
    </div>
  );
}
