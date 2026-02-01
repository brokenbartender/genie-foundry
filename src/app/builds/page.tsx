import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const builds = await prisma.build.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      runs: {
        orderBy: { createdAt: "desc" },
        include: { artifacts: true, steps: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Build Logs</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Latest generated apps and artifacts.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/40"
          >
            Back to Genie
          </Link>
        </div>

        <div className="mt-10 space-y-6">
          {builds.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-[#0f1320] p-6 text-sm text-zinc-400">
              No builds yet. Run the Genie to generate your first app.
            </div>
          ) : (
            builds.map((build) => (
              <div
                key={build.id}
                className="rounded-3xl border border-white/10 bg-[#0f1320] p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {build.summary}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                      {new Date(build.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200/40 bg-emerald-200/10 px-3 py-1 text-xs text-emerald-100">
                    {build.domain}
                  </span>
                </div>

                {build.runs.map((run) => (
                  <div key={run.id} className="mt-4">
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
                      <span>Run</span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-white/70">
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-400 md:grid-cols-3">
                      {run.steps.map((step) => (
                        <div
                          key={step.id}
                          className="rounded-2xl border border-white/10 bg-[#0b0c10] px-3 py-2"
                        >
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                            {step.status}
                          </p>
                          <p className="mt-2 text-zinc-300">{step.name}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {run.artifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="rounded-2xl border border-white/10 bg-[#0b0c10] p-4 text-xs text-zinc-300"
                        >
                          <p className="text-emerald-200/80">{artifact.type}</p>
                          <p className="mt-2 break-all text-zinc-400">
                            {artifact.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
