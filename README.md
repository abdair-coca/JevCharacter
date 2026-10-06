# JEVLING

**Tiny creature. Big decisions.**

JEVLING is a digital creature that watches cursor, touch, activity, absence, and user-provided context. Jev turns that compact world state into structured behavior instead of chat text.

## Rediseño y documentación

El rediseño aprobado contempla Home, Features determinista y About, con la paleta del Jev actual, temas claro/oscuro y ES/EN. Las fases de implementación están pendientes; la documentación distingue el diseño objetivo del runtime existente.

- [Plan y estado de las fases](.dev/TASK.md).
- [Contrato de diseño y tokens](design.md).
- [Instrucciones para agentes](AGENTS.md).
- [Índice de arquitectura e interacción](docs/README.md).
- [Historia y creador de JEV](docs/jev-story.md).

## Run locally

Requires Node.js 20.19+, 22.12+, or 24+.

```bash
npm install
npm run dev
```

Vite reads `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY`, and optional `GROQ_MODEL` from the root `.env` on the server only, then runs the real `api/decide.ts` and `api/talk.ts` handlers locally. Groq is called only after Jev selects a contextual talk action; credentials are never exposed to the browser bundle.

To use Vercel's local function runtime instead, link the project and run:

```bash
npx vercel dev
```

Never use a `VITE_` prefix for credentials. `TYPESAFE_API_KEY` and `GROQ_API_KEY` must remain server-side.

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

Press `D` outside the context input to open diagnostics and manually test supported reactions, yes/no, and talk animation states. Morph remains automatic and is not exposed as a control.

## Why Jev?

JEVLING separates behavior from generated conversation. Jev selects one validated action (reaction, visual yes/no, talk animation, or explicit morph) plus ambient intensity and attention intent through `choice`, `score`, and `noul`. Only a contextual talk action proceeds to server-side Groq streaming; other actions never request text.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Add `TYPESAFE_API_KEY` and `GROQ_API_KEY` under Project Settings → Environment Variables.
3. Optionally add `JEV_MODEL` and `GROQ_MODEL`.
4. Deploy. Vercel detects Vite and serves `api/decide.ts` and `api/talk.ts` as serverless functions.

No database, authentication, or separate backend is required.
