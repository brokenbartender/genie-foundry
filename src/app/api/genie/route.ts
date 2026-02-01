import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { runOrchestrator } from "@/lib/orchestrator";

type GenieResult = {
  id: string;
  summary: string;
  domain: string;
  stack: string[];
  plan: string[];
  deliverables: string[];
};

type GeniePayload = {
  summary: string;
  domain: string;
  stack: string[];
  plan: string[];
  deliverables: string[];
};

type SpecPayload = {
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; required: boolean }>;
  }>;
  workflows: Array<{
    name: string;
    steps: string[];
  }>;
  integrations: Array<{
    name: string;
    purpose: string;
  }>;
  pages: Array<{
    name: string;
    purpose: string;
  }>;
};

const SYSTEM_PROMPT = `You are Genie Foundry, an autonomous internal tools planner.
Return ONLY valid JSON with the following shape:
{
  "summary": string,
  "domain": "internal-tools",
  "stack": string[],
  "plan": string[],
  "deliverables": string[]
}
Rules:
- Keep summary under 140 characters.
- Stack must include: Next.js, Postgres, Auth.js, Prisma, Vercel.
- Plan should be 4-6 concrete steps.
- Deliverables should be 3-5 bullet items.
- No markdown, no extra keys, no commentary. JSON only.`;

const SPEC_PROMPT = `You are Genie Foundry, a systems analyst.
Return ONLY valid JSON with the following shape:
{
  "entities": [{ "name": string, "fields": [{ "name": string, "type": string, "required": boolean }] }],
  "workflows": [{ "name": string, "steps": string[] }],
  "integrations": [{ "name": string, "purpose": string }],
  "pages": [{ "name": string, "purpose": string }]
}
Rules:
- Keep entity and field names short.
- Use simple field types: string, number, boolean, date, enum, text.
- If unsure, provide a minimal but plausible spec.
- No markdown, no extra keys, no commentary. JSON only.`;

const OUTPUT_SCHEMA = {
  name: "genie_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      domain: { type: "string" },
      stack: { type: "array", items: { type: "string" } },
      plan: { type: "array", items: { type: "string" } },
      deliverables: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "domain", "stack", "plan", "deliverables"],
  },
} as const;

const SPEC_SCHEMA = {
  name: "genie_spec",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      entities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  required: { type: "boolean" },
                },
                required: ["name", "type", "required"],
              },
            },
          },
          required: ["name", "fields"],
        },
      },
      workflows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            steps: { type: "array", items: { type: "string" } },
          },
          required: ["name", "steps"],
        },
      },
      integrations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["name", "purpose"],
        },
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            purpose: { type: "string" },
          },
          required: ["name", "purpose"],
        },
      },
    },
    required: ["entities", "workflows", "integrations", "pages"],
  },
} as const;

function buildPlaceholder(problem: string): GenieResult {
  const clipped = problem.trim().slice(0, 140);
  return {
    id: crypto.randomUUID(),
    summary: clipped.length > 0 ? clipped : "Define the problem first.",
    domain: "internal-tools",
    stack: ["Next.js", "Postgres", "Auth.js", "Prisma", "Vercel"],
    plan: [
      "Extract requirements and success metrics",
      "Draft data model and access control matrix",
      "Generate UI layout, API routes, and validations",
      "Write tests, seed data, and CI checks",
      "Deploy preview and run smoke checks",
    ],
    deliverables: [
      "Working web app with auth and role-based access",
      "Admin dashboard + CRUD modules",
      "Deployment preview URL + setup guide",
    ],
  };
}

function buildSpecFallback(): SpecPayload {
  return {
    entities: [
      {
        name: "Item",
        fields: [
          { name: "name", type: "string", required: true },
          { name: "status", type: "enum", required: true },
          { name: "notes", type: "text", required: false },
        ],
      },
    ],
    workflows: [
      {
        name: "Intake",
        steps: ["Create item", "Assign owner", "Track status"],
      },
    ],
    integrations: [
      { name: "Email", purpose: "Send notifications on status change." },
    ],
    pages: [
      { name: "Dashboard", purpose: "Overview of KPIs and status." },
      { name: "Items", purpose: "Manage items and details." },
    ],
  };
}

function safeJsonParse(text: string): GeniePayload | null {
  try {
    return JSON.parse(text) as GeniePayload;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as GeniePayload;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { problem?: string };
    const problem = typeof body.problem === "string" ? body.problem : "";

    if (problem.trim().length < 10) {
      return NextResponse.json(
        { error: "Problem statement is too short." },
        { status: 400 }
      );
    }

    const client = new OpenAI();
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Problem:\n${problem}` },
      ],
      text: {
        format: {
          type: "json_schema",
          ...OUTPUT_SCHEMA,
        },
      },
    });

    const parsed = safeJsonParse(response.output_text ?? "");
    if (!parsed) {
      const fallback = buildPlaceholder(problem);
      return NextResponse.json(fallback);
    }

    const result: GenieResult = {
      id: crypto.randomUUID(),
      summary: parsed.summary ?? problem.slice(0, 140),
      domain: parsed.domain ?? "internal-tools",
      stack: parsed.stack ?? ["Next.js", "Postgres", "Auth.js", "Prisma", "Vercel"],
      plan: parsed.plan ?? buildPlaceholder(problem).plan,
      deliverables: parsed.deliverables ?? buildPlaceholder(problem).deliverables,
    };

    const specResponse = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: SPEC_PROMPT },
        { role: "user", content: `Problem:\n${problem}` },
      ],
      text: {
        format: {
          type: "json_schema",
          ...SPEC_SCHEMA,
        },
      },
    });

    const spec =
      (safeJsonParse(specResponse.output_text ?? "") as SpecPayload | null) ??
      buildSpecFallback();

    const build = await prisma.build.create({
      data: {
        problem,
        summary: result.summary,
        domain: result.domain,
        stack: result.stack,
        plan: result.plan,
        deliverables: result.deliverables,
      },
    });

    await runOrchestrator(build.id, problem, {
      summary: result.summary,
      domain: result.domain,
      stack: result.stack,
      plan: result.plan,
      deliverables: result.deliverables,
      spec,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500 }
    );
  }
}
