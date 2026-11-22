import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Card, ProgressStore } from "./types";
import {
  getSession,
  loadCards,
  loadProgress,
  logout,
  saveProgress,
} from "./api/storage";
import {
  applyReviewResult,
  getDueCards,
  getNewLessons,
  graduateLessonCard,
  recordActivityStreak,
  rolloverDailyStats,
} from "./core/srs";
import { Dashboard } from "./components/Dashboard";
import { ReviewSession } from "./components/ReviewSession";
import { LessonSession } from "./components/LessonSession";
import { DeckBrowser } from "./components/DeckBrowser";
import { LoginScreen } from "./components/LoginScreen";
import { setSoundEnabled } from "./core/sound";

type Mode = "dashboard" | "review" | "lesson" | "browse";
type AuthState = "checking" | "unauthenticated" | "authenticated";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [authRequired, setAuthRequired] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [store, setStore] = useState<ProgressStore | null>(null);
  const storeRef = useRef<ProgressStore | null>(null);
  const [mode, setMode] = useState<Mode>("dashboard");
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrateDeck = useCallback(() => {
    setError(null);
    Promise.all([loadCards(), loadProgress()])
      .then(([loadedCards, loadedStore]) => {
        setCards(loadedCards);
        storeRef.current = loadedStore;
        setStore(loadedStore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    getSession()
      .then((session) => {
        setAuthRequired(session.authRequired);
        if (session.authenticated) {
          setAuthState("authenticated");
          hydrateDeck();
        } else {
          setAuthState("unauthenticated");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [hydrateDeck]);

  const commitStore = (next: ProgressStore) => {
    storeRef.current = next;
    setStore(next);
    saveProgress(next).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to save progress")
    );
  };

  const theme = store?.settings.theme ?? "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const now = Date.now();
  const dueCards = useMemo(
    () => (store ? getDueCards(cards, store.cards, now) : []),
    [cards, store, mode]
  );
  const lessonCards = useMemo(
    () => (store ? getNewLessons(cards, store, now) : []),
    [cards, store, mode]
  );

  const handleCardCompleted = (cardId: string, wrongCount: number) => {
    const prev = storeRef.current;
    if (!prev) return { prevStage: 1, nextStage: 1 };

    const ts = Date.now();
    const existing = prev.cards[cardId];
    const updated = applyReviewResult(existing, cardId, wrongCount, ts);
    const withStreak = recordActivityStreak(prev.stats, ts);

    commitStore({
      ...prev,
      cards: { ...prev.cards, [cardId]: updated },
      stats: { ...withStreak, reviewsDone: withStreak.reviewsDone + 1 },
    });

    return { prevStage: existing?.stage ?? 1, nextStage: updated.stage };
  };

  const handleCardGraduated = (cardId: string) => {
    const prev = storeRef.current;
    if (!prev) return;

    const ts = Date.now();
    const withStreak = recordActivityStreak(prev.stats, ts);
    commitStore({
      ...prev,
      cards: { ...prev.cards, [cardId]: graduateLessonCard(cardId, ts) },
      stats: { ...withStreak, lessonsDone: withStreak.lessonsDone + 1 },
    });
  };

  const handleUpdateDailyLimit = (dailyNewLimit: number) => {
    const prev = storeRef.current;
    if (!prev) return;
    commitStore({
      ...prev,
      settings: { ...prev.settings, dailyNewLimit },
    });
  };

  const handleToggleTheme = () => {
    const prev = storeRef.current;
    if (!prev) return;
    const nextTheme = theme === "dark" ? "light" : "dark";
    commitStore({
      ...prev,
      settings: { ...prev.settings, theme: nextTheme },
    });
  };

  const handleImportProgress = (imported: ProgressStore) => {
    const normalized: ProgressStore = {
      ...imported,
      stats: rolloverDailyStats(imported.stats, Date.now()),
    };
    commitStore(normalized);
  };

  const handleLogout = async () => {
    await logout();
    storeRef.current = null;
    setStore(null);
    setMode("dashboard");
    setAuthState("unauthenticated");
  };

  if (error) {
    return (
      <div className="app-shell">
        <div className="panel">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <LoginScreen
        onSuccess={() => {
          setAuthState("authenticated");
          hydrateDeck();
        }}
      />
    );
  }

  if (authState === "checking" || !store) {
    return (
      <div className="app-shell">
        <div className="panel">Loading JLPT N4 deck...</div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">N4</span>
          <span>JLPT N4 Daily SRS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn theme-toggle"
            style={{ padding: "5px 10px", fontSize: "0.82rem" }}
            onClick={handleToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <span key={theme} className="theme-icon">
              {theme === "dark" ? "☀️" : "🌙"}
            </span>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            className="btn"
            style={{ padding: "5px 10px", fontSize: "0.82rem" }}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
          >
            {soundOn ? "Sound: On" : "Sound: Off"}
          </button>
          {authRequired && (
            <button
              className="btn"
              style={{ padding: "5px 10px", fontSize: "0.82rem" }}
              onClick={handleLogout}
            >
              Log out
            </button>
          )}
          <span className="muted">
            {authRequired ? "Cloud Blob · Auto-saved" : "Local JSON · Auto-saved"}
          </span>
        </div>
      </header>

      {mode === "dashboard" && (
        <Dashboard
          cards={cards}
          store={store}
          dueCount={dueCards.length}
          lessonCount={lessonCards.length}
          onStartReview={() => {
            setSessionCards(dueCards);
            setMode("review");
          }}
          onStartLessons={() => {
            setSessionCards(lessonCards);
            setMode("lesson");
          }}
          onBrowseDeck={() => setMode("browse")}
          onUpdateDailyLimit={handleUpdateDailyLimit}
          onImportProgress={handleImportProgress}
        />
      )}

      {mode === "browse" && (
        <DeckBrowser
          cards={cards}
          progressMap={store.cards}
          onExit={() => setMode("dashboard")}
        />
      )}

      {mode === "review" && (
        <ReviewSession
          cards={sessionCards}
          onCardCompleted={handleCardCompleted}
          onExit={() => setMode("dashboard")}
        />
      )}

      {mode === "lesson" && (
        <LessonSession
          cards={sessionCards}
          onCardGraduated={handleCardGraduated}
          onExit={() => setMode("dashboard")}
        />
      )}
    </div>
  );
}
