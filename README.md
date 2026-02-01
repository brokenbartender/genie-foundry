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

1. Wire `/api/genie` to the OpenAI Responses API.
2. Add an agent orchestrator (planner → builders → QA → release).
3. Add code generation templates and a deployment pipeline.

## Project layout

- `src/app/page.tsx` — Genie UI
- `src/app/api/genie/route.ts` — build pipeline entrypoint
