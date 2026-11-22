import { useRef } from "react";
import type { Card, ProgressStore } from "../types";
import { getStageInfo, isLeech } from "../core/srs";

interface DashboardProps {
  cards: Card[];
  store: ProgressStore;
  dueCount: number;
  lessonCount: number;
  onStartReview: () => void;
  onStartLessons: () => void;
  onBrowseDeck: () => void;
  onUpdateDailyLimit: (limit: number) => void;
  onImportProgress: (imported: ProgressStore) => void;
}

export function Dashboard({
  cards,
  store,
  dueCount,
  lessonCount,
  onStartReview,
  onStartLessons,
  onBrowseDeck,
  onUpdateDailyLimit,
  onImportProgress,
}: DashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buckets = {
    learning: 0,
    familiar: 0,
    strong: 0,
    master: 0,
    burned: 0,
  };

  for (const progress of Object.values(store.cards)) {
    const info = getStageInfo(progress.stage);
    if (info.bucket !== "new") {
      buckets[info.bucket] += 1;
    }
  }

  const leeches = cards.filter((c) => isLeech(store.cards[c.id]));

  const handleDownloadBackup = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jlpt-n4-progress-${store.stats.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ProgressStore;
      if (!parsed || parsed.version !== 1 || typeof parsed.cards !== "object") {
        window.alert("Invalid progress.json file.");
        return;
      }
      onImportProgress(parsed);
    } catch {
      window.alert("Could not read JSON file.");
    }
  };

  return (
    <>
      <div className="grid-2">
        <div className="panel">
          <div className="muted">Reviews Due Now</div>
          <div className="stat-value">{dueCount}</div>
          <div className="muted" style={{ marginBottom: 14 }}>
            {dueCount > 0
              ? "Ready for your daily recall check"
              : "All caught up for now"}
          </div>
          <button
            className="btn btn-primary"
            disabled={dueCount === 0}
            onClick={onStartReview}
          >
            Start Reviews
          </button>
        </div>

        <div className="panel">
          <div className="muted">New Lessons Today</div>
          <div className="stat-value" style={{ color: "var(--orange)" }}>
            {lessonCount}
          </div>
          <div className="muted" style={{ marginBottom: 14 }}>
            Learned {store.stats.lessonsDone}/{store.settings.dailyNewLimit} today
          </div>
          <button
            className="btn btn-orange"
            disabled={lessonCount === 0}
            onClick={onStartLessons}
          >
            Learn New Cards
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="topbar">
          <strong>SRS Progress ({Object.keys(store.cards).length}/{cards.length} unlocked)</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pill pill-orange">🔥 {store.stats.streak}d Streak</span>
            <span className="muted">
              Reviews today: <strong>{store.stats.reviewsDone}</strong>
            </span>
          </div>
        </div>

        <div className="srs-bar">
          <div className="srs-pill">
            <strong>{buckets.learning}</strong>
            <span>Learning</span>
          </div>
          <div className="srs-pill">
            <strong>{buckets.familiar}</strong>
            <span>Familiar</span>
          </div>
          <div className="srs-pill">
            <strong>{buckets.strong}</strong>
            <span>Strong</span>
          </div>
          <div className="srs-pill">
            <strong>{buckets.master}</strong>
            <span>Master</span>
          </div>
          <div className="srs-pill">
            <strong>{buckets.burned}</strong>
            <span>Burned</span>
          </div>
        </div>
      </div>

      {leeches.length > 0 && (
        <div className="panel">
          <strong>Weak Cards / Leeches ({leeches.length})</strong>
          <p className="muted" style={{ margin: "6px 0 10px" }}>
            Missed 5+ times and still below Familiar stage:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {leeches.map((c) => (
              <span key={c.id} className="pill pill-red">
                {c.prompt} ({c.readings[0]}) — {c.meanings[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="topbar" style={{ flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="muted">Daily New Limit:</span>
            <select
              value={store.settings.dailyNewLimit}
              onChange={(e) => onUpdateDailyLimit(Number(e.target.value))}
              style={{
                background: "var(--eel)",
                color: "var(--ink)",
                border: "2px solid var(--swan)",
                borderRadius: 10,
                padding: "6px 10px",
                fontWeight: 700,
              }}
            >
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n} / day
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-blue" onClick={onBrowseDeck}>
              Browse Kanji &amp; Vocab ({cards.length})
            </button>
            <button className="btn" onClick={handleDownloadBackup}>
              Download JSON
            </button>
            <button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </div>
        </div>
      </div>
    </>
  );
}
