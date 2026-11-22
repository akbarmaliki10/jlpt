export type CardType = "kanji" | "vocab";
export type PromptKind = "reading" | "meaning";

export interface Card {
  id: string;
  type: CardType;
  prompt: string;
  readings: string[];
  readingHint?: string;
  meanings: string[];
  notes?: string;
}

export interface CardProgress {
  cardId: string;
  stage: number; // 0 (New) .. 8 (Burned)
  nextReviewAt: number; // epoch ms
  correctStreak: number;
  totalReviews: number;
  totalWrong: number;
  lastReviewedAt: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD (study day starts at 04:00 local)
  lessonsDone: number;
  reviewsDone: number;
  streak: number;
}

export type ThemeMode = "light" | "dark";

export interface AppSettings {
  dailyNewLimit: number;
  theme?: ThemeMode;
}

export interface ProgressStore {
  version: 1;
  cards: Record<string, CardProgress>;
  stats: DailyStats;
  settings: AppSettings;
}

export interface QueueItem {
  cardId: string;
  kind: PromptKind;
}
