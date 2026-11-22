import { useMemo, useState } from "react";
import type { Card, CardProgress } from "../types";
import { getStageInfo, isCardDue } from "../core/srs";
import { SpeakButton } from "./SpeakButton";

interface DeckBrowserProps {
  cards: Card[];
  progressMap: Record<string, CardProgress>;
  onExit: () => void;
}

type TypeFilter = "all" | "kanji" | "vocab";

export function DeckBrowser({
  cards,
  progressMap,
  onExit,
}: DeckBrowserProps) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const now = Date.now();

  const kanjiCount = useMemo(
    () => cards.filter((c) => c.type === "kanji").length,
    [cards]
  );
  const vocabCount = cards.length - kanjiCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.prompt.toLowerCase().includes(q) ||
        c.readings.some((r) => r.toLowerCase().includes(q)) ||
        c.meanings.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [cards, typeFilter, search]);

  return (
    <div className="session-wrap">
      <div className="topbar">
        <button className="btn" onClick={onExit}>
          ← Dashboard
        </button>
        <span className="muted">
          Showing {filtered.length} of {cards.length} cards
        </span>
      </div>

      <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lesson-tabs">
          <button
            className={`btn ${typeFilter === "all" ? "btn-primary" : ""}`}
            onClick={() => setTypeFilter("all")}
          >
            All ({cards.length})
          </button>
          <button
            className={`btn ${typeFilter === "kanji" ? "btn-pink" : ""}`}
            onClick={() => setTypeFilter("kanji")}
          >
            Kanji ({kanjiCount})
          </button>
          <button
            className={`btn ${typeFilter === "vocab" ? "btn-blue" : ""}`}
            onClick={() => setTypeFilter("vocab")}
          >
            Vocabulary ({vocabCount})
          </button>
        </div>

        <input
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search kanji, kana reading, or English meaning..."
        />
      </div>

      <div className="deck-grid">
        {filtered.map((card) => {
          const prog = progressMap[card.id];
          const stageInfo = getStageInfo(prog?.stage ?? 0);
          const due = isCardDue(prog, now);
          const stageClass =
            stageInfo.bucket === "new"
              ? "pill-wolf"
              : stageInfo.bucket === "burned"
                ? "pill-orange"
                : "pill-green";

          return (
            <div key={card.id} className="deck-card">
              <div className="deck-card-top">
                <span
                  className={`pill ${
                    card.type === "kanji" ? "pill-pink" : "pill-blue"
                  }`}
                >
                  {card.type === "kanji" ? "Kanji" : "Vocab"}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {due && <span className="pill pill-orange">Due</span>}
                  <span className={`pill ${stageClass}`}>{stageInfo.label}</span>
                </div>
              </div>

              <div className="deck-card-prompt">{card.prompt}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="deck-card-reading">{card.readings.join(" / ")}</div>
                <SpeakButton text={card.readings[0]} label="" />
              </div>
              <div className="deck-card-meaning">{card.meanings.join(", ")}</div>
              {card.notes && <div className="deck-card-notes">{card.notes}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
