# JLPT N4 Daily SRS

Spaced-repetition app for JLPT N4 kanji and vocabulary with live romaji-to-kana typing, running either locally on Windows Desktop or deployed to Vercel with password login + Vercel Blob storage.

## Architecture

- `src/core/` — Pure domain logic (`srs.ts`, `grading.ts`, `queue.ts`, `sound.ts`) with unit tests (`core.test.ts`).
- `src/api/storage.ts` — Storage & session client (`getSession`, `login`, `logout`, `loadCards`, `loadProgress`, `saveProgress`).
- `src/components/` — `Dashboard`, `LessonSession`, `ReviewSession`, `DeckBrowser`, `LoginScreen`, `QuizPrompt`, `SpeakButton`, `Confetti`.
- `api/` — Vercel Serverless Functions (`_auth.ts`, `session.ts`, `login.ts`, `logout.ts`, `cards.ts`, `progress.ts`) backed by `@vercel/blob`.
- `server.mjs` — Zero-dependency local Node server serving `dist/` and persisting atomically to `data/progress.json`.
- `data/n4-cards.json` — 145 aligned JLPT N4 cards (75 kanji + 70 vocabulary).

## Local Commands

```bash
npm test       # Run SRS, grading, queue, deck, and auth unit tests
npm run build  # Type-check and build dist/
npm run app    # Start local server and open standalone Edge app window
```

## Deploy to Vercel (Password Login + Vercel Blob)

1. Push `jlpt-n4-srs` to a Git repo and import it in Vercel (if it's inside a parent repo, set **Root Directory** to `jlpt-n4-srs`).
2. In Vercel Project → **Storage**, create and connect a **Private** Vercel Blob store (this sets `BLOB_READ_WRITE_TOKEN` automatically).
3. In Vercel Project → **Settings → Environment Variables**, add:
   - `APP_PASSWORD` — your personal login passphrase (do **not** prefix with `VITE_`)
   - `AUTH_SECRET` — a random 32+ character string for signing the session cookie
4. Deploy. Once logged in, click **Import JSON** on the Dashboard and select your local `data/progress.json` to carry over your existing streak and progress.
