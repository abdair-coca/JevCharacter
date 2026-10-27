# JEVLING

**Tiny creature. Big decisions.**

JEVLING is a digital creature that watches cursor, touch, activity, absence, and user-provided context. Jev turns that compact world state into structured behavior instead of chat text.

## Rediseño y documentación

Home y Features fueron aceptadas para avanzar. `/features` presenta ocho escenas deterministas ES/EN, sin IA ni cambios en la sesión de Home. `/about` presenta el recorrido de Abdair Coca: Bob, TitiEdu, machine learning y JEV/visión futura, con partículas 2D y lectura lineal adaptada a móvil/movimiento reducido. En Inicio, «quiero inscribirme» abre la inscripción UATF, que guarda cada registro en Supabase. Las entregas de About y UATF esperan revisión visual.

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

Vite reads `TYPESAFE_API_KEY`, `JEV_MODEL`, optional `GROQ_MODEL`, `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from the root `.env` on the server only, then runs the real `api/decide.ts`, `api/talk.ts` and `api/enroll.ts` handlers locally. Groq is called only after Jev selects a contextual talk action, with the Groq key that each visitor saves in Ajustes; that key stays in their browser and reaches `/api/talk` only in a request header. Ajustes explains step by step how to get that key. Credentials are never exposed to the browser bundle.

### Supabase (UATF enrollments)

1. In the Supabase project, open **SQL Editor** and run [`supabase/migrations/20261026000000_enrollments.sql`](supabase/migrations/20261026000000_enrollments.sql). It creates `enrollments` with RLS and no policies, so browsers can neither read nor write it.
2. From **Project Settings › API Keys**, copy the project URL and a **secret** key (`sb_secret_…`) into `.env` as `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Never the publishable key, and never with a `VITE_` prefix.
3. Read the enrollments in **Table Editor › enrollments**. Without these variables, `/api/enroll` answers 503 and the form asks the visitor to try again.

Use `npm run dev` to try real API-backed interaction locally. `npm run preview` serves the production frontend only; the automated browser harness supplies its own local HTTP/SSE fixtures for API tests.

To use Vercel's local function runtime instead, link the project and run:

```bash
npx vercel dev
```

Never use a `VITE_` prefix for credentials. `TYPESAFE_API_KEY` must remain server-side. The Groq key is never read from the environment: visitors enter their own in Ajustes.

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
npm run test:e2e
npm run build
```

`test:e2e` levanta el build con `vite preview` y ejecuta Playwright en Chromium sin llamar a proveedores. `.github/workflows/ci.yml` repite lint, typecheck, Vitest y e2e en cada push a `main` y en cada PR.

`lint` ejecuta ESLint sin advertencias; `lint:ox` conserva el verificador previo. TypeScript strict está habilitado en los cuatro proyectos. Tailwind v4 consume `src/styles/tokens.css`; el Button de shadcn/ui, Motion y Zustand cubren controles, feedback y preferencias. Features carga XState de forma diferida; Features/About comparten GSAP/ScrollTrigger y un manager global Lenis, que Home no descarga inicialmente. Historial del rediseño en git (`.dev/task.md` se vació tras la aprobación de la fase 5); evidencia de [fase 1](.dev/evidence/phase-1/README.md), [fase 2](.dev/evidence/phase-2/README.md), [fase 3](.dev/evidence/phase-3/README.md), [fase 4 con comandos cortos](.dev/evidence/phase-4/README.md) y [fase 5: integración, accesibilidad, rendimiento y voz](.dev/evidence/phase-5/README.md). La voz de Jev y la música de Historia usan Web Audio sin dependencias nuevas.

## Deploy to Vercel

### API-backed deployment (current publication)

Published at **[jev-bot-sigma.vercel.app](https://jev-bot-sigma.vercel.app)** with a verified real remote decision. [Production checks and screenshot](.dev/evidence/decision-production/README.md).

1. Add `TYPESAFE_API_KEY` to the project's Production environment. `JEV_MODEL` defaults to `jev-latest`.
2. Generated speech needs no server key: each visitor adds a Groq key in Ajustes. `GROQ_MODEL` remains optional.
3. For UATF enrollments, add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` to the Production environment as well.
4. Use the regular build (`npm run build`, output `dist`) and create a new deployment:

```bash
vercel deploy --prod
```

Vercel serves `api/decide.ts`, `api/talk.ts` and `api/enroll.ts` as functions. `api/tsconfig.json` supplies NodeNext/Node types to the function compiler; server ESM imports use explicit `.js` extensions. The root tsconfig remains a project-reference entrypoint. Provider credentials stay server-side. The only database is the Supabase `enrollments` table; no separate server is required.

### Frontend-only alternative (previous publication)

[Previous static deployment checks](.dev/evidence/deployment/README.md).

Home uses local reactions; Features and Story work without APIs. AI-generated speech and UATF enrollments are unavailable in this build: the form opens, but sending fails with its retry notice. No provider keys are needed.

```bash
vercel link --project jev-bot
npm run build:frontend
vercel deploy --prebuilt --prod
```

`build:frontend` selects Vite's `frontend` mode and generates `.vercel/output` with static files and direct-route support for `/features` and `/about`. The prebuilt deployment uploads only that artifact, without `api/*` or serverless functions. Use `--prebuilt` only for that alternative. To activate APIs or use changed server environment variables, create a regular new deployment instead of trying to redeploy the prebuilt artifact.
