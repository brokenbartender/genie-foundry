# Genie Foundry

Autonomous internal tools builder. Users describe a business problem and the system produces a working app: schema, UI, API, tests, and deployment.

## What’s included

- Next.js App Router UI for the “software genie” experience
- `/api/genie` endpoint (placeholder) for orchestration output
- Opinionated stack: Next.js + Postgres + Auth.js + Prisma + Vercel

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment

Create `C:\Users\codym\Documents\ai-app-factory\.env.local` and add:

```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
DEMO_ORIGIN=https://your-demo-site.example.com
DEMO_KEY=optional-demo-key
```

Database is local SQLite by default. Prisma uses `.env` for `DATABASE_URL`:

```
DATABASE_URL="file:./dev.db"
```

Run migrations:

```bash
npx prisma migrate dev
```

## Next steps

1. `/api/genie` is wired to the OpenAI Responses API.
2. Optional LexiPro demo endpoints: `/api/lexi/analyze` and `/api/lexi/chat` (CORS safe).
3. Add an agent orchestrator (planner → builders → QA → release).
4. Add code generation templates and a deployment pipeline.

## Project layout

- `src/app/page.tsx` — Genie UI
- `src/app/api/genie/route.ts` — build pipeline entrypoint
