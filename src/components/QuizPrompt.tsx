import { useEffect, useRef, useState } from "react";
import type { Card, PromptKind } from "../types";
import {
  convertLiveKana,
  gradeMeaning,
  gradeReading,
  normalizeReadingInput,
} from "../core/grading";
import {
  playCorrectSound,
  playLevelUpSound,
  playWrongSound,
} from "../core/sound";
import { SpeakButton } from "./SpeakButton";

export interface FeedbackMeta {
  badge?: string;
  tone?: "green" | "red" | "amber";
}

interface QuizPromptProps {
  card: Card;
  kind: PromptKind;
  itemKey: string;
  onSubmitAnswer: (isCorrect: boolean) => FeedbackMeta | void;
  onAdvance: () => void;
}

export function QuizPrompt({
  card,
  kind,
  itemKey,
  onSubmitAnswer,
  onAdvance,
}: QuizPromptProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{
    isCorrect: boolean;
    typed: string;
    meta?: FeedbackMeta;
  } | null>(null);
  const [exitDir, setExitDir] = useState<"correct" | "wrong" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrongShownAtRef = useRef<number>(0);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setInput("");
    setResult(null);
    setExitDir(null);
    inputRef.current?.focus();
  }, [itemKey]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  const handleChange = (raw: string) => {
    if (result) return;
    setInput(kind === "reading" ? convertLiveKana(raw) : raw);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (result) {
      if (exitDir) return;
      // Short cooldown on wrong answers so fast typing doesn't skip reading the correction.
      if (!result.isCorrect && performance.now() - wrongShownAtRef.current < 300) {
        return;
      }
      const dir = result.isCorrect ? "correct" : "wrong";
      setExitDir(dir);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      exitTimerRef.current = window.setTimeout(() => {
        exitTimerRef.current = null;
        onAdvance();
      }, reduced ? 0 : 160);
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) return;

    const displayTyped =
      kind === "reading" ? normalizeReadingInput(trimmed) : trimmed;
    if (kind === "reading") setInput(displayTyped);

    const isCorrect =
      kind === "reading"
        ? gradeReading(trimmed, card.readings)
        : gradeMeaning(trimmed, card.meanings);

    if (!isCorrect) {
      wrongShownAtRef.current = performance.now();
    }

    const meta = onSubmitAnswer(isCorrect) || undefined;
    if (!isCorrect) {
      playWrongSound();
    } else if (meta?.tone === "green" && meta.badge) {
      playLevelUpSound();
    } else {
      playCorrectSound();
    }
    setResult({ isCorrect, typed: displayTyped, meta });
  };

  const boxClass = result
    ? `answer-box ${result.isCorrect ? "correct" : "wrong"}`
    : "answer-box";
  const stageClass = [
    "card-stage",
    card.type,
    exitDir === "correct" ? "exit-correct" : "",
    exitDir === "wrong" ? "exit-wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div key={itemKey} className={stageClass}>
        {result?.isCorrect && (
          <span className="card-burst-badge">
            ✓ {result.meta?.badge ?? "Nice!"}
          </span>
        )}
        <span className="card-type-chip">
          {card.type === "kanji" ? "Kanji" : "Vocabulary"}
        </span>
        <h1 className="card-prompt">{card.prompt}</h1>
        <div className="prompt-question">
          {kind === "reading"
            ? "Type Reading in Romaji"
            : "Type Meaning in English"}
        </div>
        {kind === "meaning" && (
          <SpeakButton text={card.readings[0]} variant="onCard" />
        )}
      </div>

      <form onSubmit={handleSubmit} className={boxClass}>
        <span className={`mode-badge ${kind === "reading" ? "kana" : ""}`}>
          {kind === "reading" ? "あ Kana" : "Aa Meaning"}
        </span>
        <input
          ref={inputRef}
          className="answer-input"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={
            kind === "reading"
              ? "Type romaji (e.g. taberu)..."
              : "Type meaning..."
          }
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          readOnly={result !== null}
        />
        <button type="submit" className="btn btn-primary">
          {result ? "Next ↵" : "Check ↵"}
        </button>
      </form>

      {result && (
        <div
          className={`feedback-drawer ${result.isCorrect ? "correct" : "wrong"}`}
        >
          <div className="feedback-header">
            <span
              className={`pill ${result.isCorrect ? "pill-green" : "pill-red"}`}
            >
              {result.isCorrect ? "Correct" : "Incorrect"}
            </span>
            {result.meta?.badge && (
              <span
                className={`pill ${
                  result.meta.tone === "amber"
                    ? "pill-amber"
                    : result.meta.tone === "green"
                      ? "pill-green"
                      : "pill-red"
                }`}
              >
                {result.meta.badge}
              </span>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <strong>Reading:</strong> {card.readings.join(" / ")}
              {card.readingHint && (
                <span className="muted"> ({card.readingHint})</span>
              )}
              {" "}·{" "}
              <strong>Meaning:</strong> {card.meanings.join(", ")}
            </div>
            <SpeakButton text={card.readings[0]} />
          </div>
          {card.notes && (
            <div className="muted" style={{ marginTop: 4 }}>
              {card.notes}
            </div>
          )}
          <div className="muted" style={{ marginTop: 6 }}>
            Press <strong>Enter</strong> to continue
          </div>
        </div>
      )}
    </>
  );
}
