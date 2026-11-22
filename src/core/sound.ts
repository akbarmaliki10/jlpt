let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let unlockBound = false;

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (!enabled && canSpeakJapanese()) {
    window.speechSynthesis.cancel();
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

function bindGestureUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;

  const unlock = () => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    if (ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    }
  };

  window.addEventListener("pointerdown", unlock, true);
  window.addEventListener("keydown", unlock, true);
}

bindGestureUnlock();

function withAudio(fn: (ctx: AudioContext) => void): void {
  if (!soundEnabled) return;
  const ctx = ensureContext();
  if (!ctx) return;

  if (ctx.state === "running") {
    fn(ctx);
    return;
  }

  // Wait for AudioContext.resume() before scheduling tones so notes aren't dropped while suspended.
  ctx
    .resume()
    .then(() => {
      if (soundEnabled && ctx.state === "running") fn(ctx);
    })
    .catch(() => {});
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType,
  peakGain: number
): void {
  const start = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + durationSec + 0.02);
}

/** Bright two-note chime for a single correct answer. */
export function playCorrectSound(): void {
  withAudio((ctx) => {
    playTone(ctx, 587.33, 0, 0.13, "sine", 0.28); // D5
    playTone(ctx, 880.0, 0.07, 0.2, "sine", 0.32); // A5
  });
}

/** Extra rewarding rising arpeggio when a card completes and advances SRS stage. */
export function playLevelUpSound(): void {
  withAudio((ctx) => {
    playTone(ctx, 523.25, 0, 0.13, "triangle", 0.26); // C5
    playTone(ctx, 659.25, 0.07, 0.13, "triangle", 0.28); // E5
    playTone(ctx, 783.99, 0.14, 0.15, "triangle", 0.3); // G5
    playTone(ctx, 1046.5, 0.21, 0.26, "sine", 0.32); // C6
  });
}

/** Gentle low double-tone for a missed answer. */
export function playWrongSound(): void {
  withAudio((ctx) => {
    playTone(ctx, 240, 0, 0.12, "triangle", 0.3);
    playTone(ctx, 185, 0.09, 0.18, "triangle", 0.28);
  });
}

/** Upbeat celebratory "hooray" fanfare for completing a lesson or review session. */
export function playCelebrationSound(): void {
  withAudio((ctx) => {
    // Crisp rising fanfare: C5 -> E5 -> G5 -> C6 -> G5 -> C6+E6+G6 chord
    playTone(ctx, 523.25, 0.0, 0.12, "triangle", 0.28);
    playTone(ctx, 659.25, 0.09, 0.12, "triangle", 0.28);
    playTone(ctx, 783.99, 0.18, 0.12, "triangle", 0.3);
    playTone(ctx, 1046.5, 0.27, 0.18, "sine", 0.32);
    playTone(ctx, 783.99, 0.41, 0.11, "triangle", 0.26);
    playTone(ctx, 1046.5, 0.5, 0.45, "sine", 0.32);
    playTone(ctx, 1318.5, 0.5, 0.45, "sine", 0.22);
    playTone(ctx, 1567.98, 0.5, 0.45, "triangle", 0.18);
  });
}

export function canSpeakJapanese(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak Japanese kana/word using the browser's built-in ja-JP SpeechSynthesis voice. */
export function speakJapanese(text: string): boolean {
  if (!soundEnabled || !canSpeakJapanese() || !text.trim()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  utterance.rate = 0.9;

  const jaVoice = synth
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith("ja"));
  if (jaVoice) utterance.voice = jaVoice;

  synth.speak(utterance);
  return true;
}
