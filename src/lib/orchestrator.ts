import path from "path";
import { promises as fs } from "fs";
import { prisma } from "@/lib/prisma";
import { generateScaffold } from "@/lib/generator";
import { generateAppScaffold } from "@/lib/scaffold";
import { execFile } from "child_process";
import { promisify } from "util";

type Capability = {
  id: string;
  label: string;
  description: string;
};

const CAPABILITIES: Capability[] = [
  {
    id: "crud",
    label: "CRUD data management",
    description: "Create/read/update/delete records with audit history.",
  },
  {
    id: "workflow",
    label: "Workflow automation",
    description: "Multi-step approvals, states, and notifications.",
  },
  {
    id: "dashboard",
    label: "Analytics dashboard",
    description: "KPIs, charts, and operational insights.",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connectors for email, Slack, Jira, and webhooks.",
  },
];

type GenieResult = {
  summary: string;
  domain: string;
  stack: string[];
  plan: string[];
  deliverables: string[];
  spec: {
    entities: Array<{
      name: string;
      fields: Array<{ name: string; type: string; required: boolean }>;
    }>;
    workflows: Array<{ name: string; steps: string[] }>;
    integrations: Array<{ name: string; purpose: string }>;
    pages: Array<{ name: string; purpose: string }>;
  };
};

type OrchestratorOutput = {
  buildId: string;
  runId: string;
  manifestPath: string;
};

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function runOrchestrator(
  buildId: string,
  problem: string,
  result: GenieResult
): Promise<OrchestratorOutput> {
  const execFileAsync = promisify(execFile);
  const run = await prisma.buildRun.create({
    data: {
      buildId,
      status: "running",
      steps: {
        create: result.plan.map((step) => ({
          name: step,
          status: "pending",
        })),
      },
    },
    include: { steps: true },
  });

  const workspace = path.join(
    process.cwd(),
    "generated",
    normalizeName(result.summary) || buildId
  );

  try {
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(path.join(workspace, "app"), { recursive: true });
    await fs.mkdir(path.join(workspace, "backend"), { recursive: true });
    await fs.mkdir(path.join(workspace, "infra"), { recursive: true });

    const manifest = {
      buildId,
      runId: run.id,
      problem,
      summary: result.summary,
      domain: result.domain,
      stack: result.stack,
      plan: result.plan,
      deliverables: result.deliverables,
      capabilities: CAPABILITIES,
      spec: result.spec,
    };

    const manifestPath = path.join(workspace, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    await prisma.artifact.create({
      data: {
        runId: run.id,
        type: "manifest",
        path: manifestPath,
      },
    });

    const spec = {
      name: result.summary,
      domain: result.domain,
      constraints: {
        dataResidency: "local",
        auth: "Auth.js",
        database: "Postgres (target) / SQLite (dev)",
        deployment: "Vercel",
      },
      entities: result.spec.entities,
      workflows: result.spec.workflows,
      integrations: result.spec.integrations,
      pages: result.spec.pages,
      acceptanceCriteria: [
        "Users can authenticate and access role-appropriate views.",
        "Core data flows are validated and persisted.",
        "The app passes lint, typecheck, and smoke tests.",
      ],
    };

    const specPath = path.join(workspace, "app-spec.json");
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2), "utf8");

    await prisma.artifact.createMany({
      data: [
        { runId: run.id, type: "spec", path: specPath },
        {
          runId: run.id,
          type: "readme",
          path: path.join(workspace, "README.md"),
        },
      ],
    });

    const readme = `# Generated App\n\nSummary: ${result.summary}\n\n## Next steps\n- Replace placeholders in app-spec.json\n- Generate UI scaffolds\n- Generate API scaffolds\n- Run tests\n`;
    await fs.writeFile(path.join(workspace, "README.md"), readme, "utf8");

    const generatedArtifacts = await generateScaffold(workspace, spec);
    const appArtifacts = await generateAppScaffold(workspace, spec);
    await prisma.artifact.createMany({
      data: generatedArtifacts.map((artifactPath) => ({
        runId: run.id,
        type: "generated",
        path: artifactPath,
      })),
    });

    await prisma.artifact.createMany({
      data: appArtifacts.map((artifactPath) => ({
        runId: run.id,
        type: "app",
        path: artifactPath,
      })),
    });

    await validateArtifacts([
      manifestPath,
      specPath,
      ...generatedArtifacts,
      ...appArtifacts,
    ]);

    await execFileAsync("npm", ["run", "verify:generated"], {
      cwd: process.cwd(),
    });

    await prisma.buildRun.update({
      where: { id: run.id },
      data: {
        status: "ready",
        steps: {
          updateMany: {
            where: { runId: run.id },
            data: { status: "completed" },
          },
        },
      },
    });
  } catch (error) {
    await prisma.buildRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        steps: {
          updateMany: {
            where: { runId: run.id },
            data: { status: "failed" },
          },
        },
      },
    });
    throw error;
  }

  return {
    buildId,
    runId: run.id,
    manifestPath,
  };
}

async function validateArtifacts(paths: string[]) {
  const checks = await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.stat(filePath);
        return null;
      } catch {
        return filePath;
      }
    })
  );

  const missing = checks.filter(Boolean) as string[];
  if (missing.length > 0) {
    throw new Error(`Missing generated artifacts: ${missing.join(", ")}`);
  }
}
