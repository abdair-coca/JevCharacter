# JEVLING

**Tiny creature. Big decisions.**

JEVLING is a digital creature that watches cursor, touch, activity, absence, and user-provided context. Jev turns that compact world state into structured behavior instead of chat text.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Vite development mode runs the full experience with local-instinct fallback. To test the real serverless Jev route locally, create `.env.local` from `.env.example`, add your key, then run:

```bash
npx vercel dev
```

Never use a `VITE_` prefix for the key. `TYPESAFE_API_KEY` must remain server-side.

Optional model pinning:

```text
JEV_MODEL=jev-latest
```

## Architecture

```text
Rive              = body
Pointer sensors   = perception
Jev               = instinct
Local personality = memory
```

Rive follow behavior stays local and immediate. Summarized behavior reaches `/api/decide` only after meaningful activity, with cooldown, deduplication, caching, and client rate limits. Network or configuration failures automatically use `fallbackBrain.ts`.

Press `D` outside the context input to open diagnostics and manually test every supported Rive reaction.

## Why Jev?

JEVLING needs a decision, not generated conversation. Jev evaluates one structured state and returns reaction choice, environmental intensity, and attention intent through `choice`, `score`, and `noul`.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `TYPESAFE_API_KEY` under Project Settings → Environment Variables.
3. Optionally add `JEV_MODEL`.
4. Deploy. Vercel detects Vite and serves `api/decide.ts` as the only serverless function.

No database, authentication, or separate backend is required.
