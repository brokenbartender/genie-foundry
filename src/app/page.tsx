"use client";

import { useMemo, useState } from "react";

type GenieResult = {
  id: string;
  summary: string;
  domain: string;
  stack: string[];
  plan: string[];
  deliverables: string[];
};

const EXAMPLES = [
  "We need an internal tool to track inventory across 3 warehouses, alert low stock, and log supplier restocks.",
  "Build a client onboarding dashboard that assigns tasks, collects documents, and shows status per client.",
  "Create a simple approvals workflow for marketing assets with audit history and comments.",
];

const DEFAULT_RESULT: GenieResult = {
  id: "preview",
  summary: "Awaiting a problem statement.",
  domain: "internal-tools",
  stack: ["Next.js", "Postgres", "Auth.js", "Prisma", "Vercel"],
  plan: [
    "Extract requirements and success metrics",
    "Draft data model and permissions map",
    "Generate UI layout and API routes",
    "Write tests, seed data, and CI checks",
    "Deploy preview and run smoke checks",
  ],
  deliverables: [
    "Working web app with auth and role-based access",
    "Admin dashboard + CRUD modules",
    "Deployment preview URL + setup guide",
  ],
};

export default function Home() {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<GenieResult>(DEFAULT_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBuild, setLastBuild] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const canSubmit = problem.trim().length > 12;
  const placeholder = useMemo(
    () =>
      "Describe the problem in plain language. Example: 'We need a tool to track inventory, alert low stock, and manage suppliers with approvals.'",
    []
  );

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/genie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
      });

      if (!response.ok) {
        throw new Error("Genie failed to build a plan.");
      }

      const data = (await response.json()) as GenieResult;
      setResult(data);
      setLastBuild(new Date().toLocaleString());
      setLastSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="grain gridlines min-h-screen">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#12151d] text-xl shadow-[0_0_30px_rgba(119,242,198,0.25)]">
              ⚡
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">
                Genie Foundry
              </p>
              <p className="text-xs text-zinc-400">
                Autonomous internal tools builder
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/builds"
              className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40"
            >
              Build Logs
            </a>
            <div className="rounded-full border border-emerald-200/40 bg-emerald-200/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100">
              QA: Enabled
            </div>
          </div>
        </header>

        <main className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-20 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-8">
            <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-[#111522] via-[#0d101a] to-[#0b0c10] p-8 shadow-[0_0_80px_rgba(119,242,198,0.08)]">
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/70">
                Problem In
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-white">
                Describe the problem. Genie builds the app.
              </h1>
              <p className="mt-4 text-base text-zinc-400">
                You give the pain. We ship a working internal tool with auth,
                database, UI, and deployment already wired.
              </p>

              <div className="mt-8 space-y-4">
                <textarea
                  value={problem}
                  onChange={(event) => setProblem(event.target.value)}
                  placeholder={placeholder}
                  className="min-h-[160px] w-full resize-none rounded-3xl border border-white/10 bg-[#0b0c10] px-6 py-5 text-base text-white shadow-inner outline-none transition focus:border-emerald-200/70 focus:ring-2 focus:ring-emerald-200/20"
                />

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || loading}
                    className="rounded-full bg-emerald-200 px-6 py-3 text-sm font-semibold text-[#0b0c10] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:bg-emerald-200/40"
                  >
                    {loading ? "Generating…" : "Build the app"}
                  </button>
                  <button
                    onClick={() => setProblem("")}
                    className="rounded-full border border-white/10 px-6 py-3 text-sm text-white/70 transition hover:border-white/30"
                  >
                    Clear
                  </button>
                  {error && (
                    <span className="text-sm text-rose-300">{error}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => setProblem(example)}
                  className="rounded-3xl border border-white/10 bg-[#0f1320] p-4 text-left text-sm text-zinc-300 transition hover:border-emerald-200/50 hover:text-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#0f1320]/80 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">
                Current Build
              </p>
              <h2 className="mt-3 text-2xl font-semibold">{result.summary}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Target domain: {result.domain}
              </p>
              {lastBuild && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-emerald-200/70">
                  Last build: {lastBuild}
                </p>
              )}

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                    Stack
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.stack.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-emerald-200/40 bg-emerald-200/10 px-3 py-1 text-xs text-emerald-100"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                    Autonomy Flow
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                    {result.plan.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="mt-0.5 text-xs text-emerald-200/80">
                          0{index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#12151d] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">
                Output
              </p>
              <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                {result.deliverables.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-amber-200">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {lastSummary && (
                <div className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-4 py-3 text-xs text-amber-100/90">
                  Latest build: {lastSummary}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
