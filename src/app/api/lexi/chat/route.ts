import { NextResponse } from "next/server";
import OpenAI from "openai";

type ChatPayload = {
  question?: string;
};

type ChatResult = {
  answer: string;
};

const OUTPUT_SCHEMA = {
  name: "lexipro_chat",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string" },
    },
    required: ["answer"],
  },
} as const;

const SYSTEM_PROMPT = `You are LexiPro Demo Assistant.
Answer questions about the LexiPro Forensic OS demo.
Rules:
- Keep answers concise (2-4 sentences).
- Only describe features visible in the demo: pillars, guided investigation, evidence anchors, audit trail, integrations, ROI, trust signals.
- Avoid legal advice or jurisdiction-specific claims.
- If unsure, say the demo emphasizes evidence-bound, auditable outputs.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.DEMO_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-demo-key",
};

const safeJson = (text: string): ChatResult | null => {
  try {
    return JSON.parse(text) as ChatResult;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ChatResult;
    } catch {
      return null;
    }
  }
};

const buildFallback = (question: string): ChatResult => {
  if (/pillar|pillars/i.test(question)) {
    return {
      answer:
        "LexiPro is built on three pillars: Evidence Integrity, Bounded Reasoning, and Auditability. These ensure every claim is anchored to a source and logged in a tamper-evident trail.",
    };
  }
  if (/integrat|relativity|imanage|clio/i.test(question)) {
    return {
      answer:
        "The demo shows export-ready proof packs that flow into Relativity, iManage, and Clio. Integrations are simulated but illustrate deterministic output injection into existing workflows.",
    };
  }
  if (/security|trust|soc 2|sso|rbac|byok/i.test(question)) {
    return {
      answer:
        "Trust signals include SOC 2 readiness, BYOK, SSO/RBAC, data residency controls, and a Merkle-tree audit ledger that preserves chain-of-custody integrity.",
    };
  }
  if (/roi|value|cost/i.test(question)) {
    return {
      answer:
        "The ROI snapshot highlights measurable impact: 14.5 billable hours saved, 82% overhead reduction, and $4,200 cost recovery per matter.",
    };
  }
  return {
    answer:
      "LexiPro is a forensic OS that makes AI outputs admissible by enforcing evidence anchors, deterministic audit trails, and custody sealing. Ask about pillars, integrations, security, or ROI.",
  };
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on the server." },
        { status: 500, headers: corsHeaders }
      );
    }

    if (process.env.DEMO_KEY) {
      const key = request.headers.get("x-demo-key") ?? "";
      if (key !== process.env.DEMO_KEY) {
        return NextResponse.json(
          { error: "Unauthorized." },
          { status: 401, headers: corsHeaders }
        );
      }
    }

    const body = (await request.json()) as ChatPayload;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return NextResponse.json(buildFallback(""), { headers: corsHeaders });
    }

    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      text: { format: { type: "json_schema", ...OUTPUT_SCHEMA } },
    });

    const parsed = safeJson(response.output_text ?? "");
    if (!parsed) {
      return NextResponse.json(buildFallback(question), { headers: corsHeaders });
    }

    return NextResponse.json(parsed, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500, headers: corsHeaders }
    );
  }
}
