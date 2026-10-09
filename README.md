# JEVLING

**Tiny creature. Big decisions.**

JEVLING is a digital creature that watches cursor, touch, activity, absence, and user-provided context. Jev turns that compact world state into structured behavior instead of chat text.

## Rediseño y documentación

Home y Features fueron aceptadas para avanzar. `/features` presenta ocho escenas deterministas ES/EN, sin IA ni cambios en la sesión de Home. `/about` presenta el recorrido de Abdair Coca: Bob, TitiEdu, machine learning y JEV/visión futura, con partículas 2D y lectura lineal adaptada a móvil/movimiento reducido. En Inicio, «quiero inscribirme» abre la demo local UATF. Las entregas de About y UATF esperan revisión visual.

- [Spec de producto](.dev/spec.md), [plan por fases](.dev/plan.md) y [tarea/handoff activo](.dev/task.md).
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

Use `npm run dev` to try real API-backed interaction locally. `npm run preview` serves the production frontend only; the automated browser harness supplies its own local HTTP/SSE fixtures for API tests.

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
npm run typecheck:tests
npm run lint
npm test
npm run build
```

`lint` ejecuta ESLint sin advertencias; `lint:ox` conserva el verificador previo. TypeScript strict está habilitado en los cuatro proyectos. Tailwind v4 consume `src/styles/tokens.css`; el Button de shadcn/ui, Motion y Zustand cubren controles, feedback y preferencias. Features carga XState de forma diferida; Features/About comparten GSAP/ScrollTrigger y un manager global Lenis, que Home no descarga inicialmente. Estado en [task.md](.dev/task.md); evidencia de [fase 1](.dev/evidence/phase-1/README.md), [fase 2](.dev/evidence/phase-2/README.md), [fase 3](.dev/evidence/phase-3/README.md) y [fase 4 con comandos cortos](.dev/evidence/phase-4/README.md).

## Deploy to Vercel

### API-backed deployment (current publication)

Published at **[jev-bot-sigma.vercel.app](https://jev-bot-sigma.vercel.app)** with a verified real remote decision. [Production checks and screenshot](.dev/evidence/decision-production/README.md).

1. Add `TYPESAFE_API_KEY` to the project's Production environment. `JEV_MODEL` defaults to `jev-latest`.
2. For generated speech, also configure `GROQ_API_KEY` and optionally `GROQ_MODEL`.
3. Use the regular build (`npm run build`, output `dist`) and create a new deployment:

```bash
vercel deploy --prod
```

Vercel serves `api/decide.ts` and `api/talk.ts` as functions. `api/tsconfig.json` supplies NodeNext/Node types to the function compiler; server ESM imports use explicit `.js` extensions. The root tsconfig remains a project-reference entrypoint. Provider credentials stay server-side. No separate server or database is required.

### Frontend-only alternative (previous publication)

[Previous static deployment checks](.dev/evidence/deployment/README.md).

Home uses local reactions; Features, Story and the UATF form work without APIs. AI-generated speech is unavailable in this build. No provider keys are needed.

```bash
vercel link --project jev-bot
npm run build:frontend
vercel deploy --prebuilt --prod
```

`build:frontend` selects Vite's `frontend` mode and generates `.vercel/output` with static files and direct-route support for `/features` and `/about`. The prebuilt deployment uploads only that artifact, without `api/*` or serverless functions. Use `--prebuilt` only for that alternative. To activate APIs or use changed server environment variables, create a regular new deployment instead of trying to redeploy the prebuilt artifact.
