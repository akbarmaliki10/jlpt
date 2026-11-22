import { toHiragana } from "wanakana";

/**
 * Convert typed romaji/kana to normalized hiragana for grading.
 * Calling toHiragana with IMEMode=false also resolves a trailing "n" -> "ん".
 */
export function normalizeReadingInput(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, "");
  if (!cleaned) return "";
  return toHiragana(cleaned, { IMEMode: false });
}

/** Live conversion while typing in the input box (keeps trailing 'n' pending until next key or submit). */
export function convertLiveKana(raw: string): string {
  return toHiragana(raw, { IMEMode: true });
}

export function gradeReading(userInput: string, expectedReadings: string[]): boolean {
  const normalizedInput = normalizeReadingInput(userInput);
  if (!normalizedInput) return false;

  return expectedReadings.some(
    (reading) => normalizeReadingInput(reading) === normalizedInput
  );
}

function normalizeMeaning(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:'"()\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripVerbPrefix(s: string): string {
  return s.startsWith("to ") ? s.slice(3).trim() : s;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n];
}

export function gradeMeaning(userInput: string, expectedMeanings: string[]): boolean {
  const normInput = normalizeMeaning(userInput);
  if (!normInput) return false;
  const inputNoTo = stripVerbPrefix(normInput);

  return expectedMeanings.some((meaning) => {
    const normExpected = normalizeMeaning(meaning);
    const expectedNoTo = stripVerbPrefix(normExpected);

    if (normInput === normExpected || inputNoTo === expectedNoTo) return true;
    const maxLen = Math.max(inputNoTo.length, expectedNoTo.length);
    return maxLen >= 5 && editDistance(inputNoTo, expectedNoTo) <= 1;
  });
}
