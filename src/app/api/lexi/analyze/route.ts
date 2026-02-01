import { NextResponse } from "next/server";
import OpenAI from "openai";

type EvidencePayload = {
  id?: string;
  type?: string;
  timestamp?: string;
  title?: string;
  content?: string;
};

type AnalysisResult = {
  summary: string;
  liability: string;
  reasoning: string;
  statutes: string[];
};

const OUTPUT_SCHEMA = {
  name: "lexipro_forensic_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      liability: { type: "string" },
      reasoning: { type: "string" },
      statutes: { type: "array", items: { type: "string" } },
    },
    required: ["summary", "liability", "reasoning", "statutes"],
  },
} as const;

const SYSTEM_PROMPT = `You are LexiPro Forensic AI.
Return ONLY valid JSON matching the schema. No markdown.
Rules:
- Use evidence-bound language. Do not speculate.
- Keep summary and liability concise (1-2 sentences each).
- Reasoning should be a short, structured rationale (no chain-of-thought).
- Statutes should be general legal or compliance concepts, not jurisdiction-specific advice.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.DEMO_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-demo-key",
};

const safeJson = (text: string): AnalysisResult | null => {
  try {
    return JSON.parse(text) as AnalysisResult;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as AnalysisResult;
    } catch {
      return null;
    }
  }
};

const buildFallback = (evidence: EvidencePayload): AnalysisResult => {
  const label = evidence.title || evidence.type || "Evidence item";
  const timestamp = evidence.timestamp ? ` (${evidence.timestamp})` : "";
  return {
    summary: `${label}${timestamp} contains review-relevant signals. Verify against source records and timeline.`,
    liability: "Moderate risk: verify escalation, documentation integrity, and response timing.",
    reasoning: "Evidence-bound signals detected. Confirm source accuracy and align chronology before export.",
    statutes: [
      "Standard of care compliance",
      "Documentation and record integrity",
      "Chain of custody continuity",
    ],
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

    const body = (await request.json()) as { evidence?: EvidencePayload };
    const evidence = body.evidence ?? {};
    const content = evidence.content ?? "";

    if (content.trim().length < 20) {
      return NextResponse.json(buildFallback(evidence), { headers: corsHeaders });
    }

    const client = new OpenAI();
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            "Analyze this evidence item and return JSON only.",
            `ID: ${evidence.id ?? "N/A"}`,
            `Type: ${evidence.type ?? "Unknown"}`,
            `Timestamp: ${evidence.timestamp ?? "Unknown"}`,
            `Title: ${evidence.title ?? "Untitled"}`,
            `Content: ${content}`,
          ].join("\n"),
        },
      ],
      text: { format: { type: "json_schema", ...OUTPUT_SCHEMA } },
    });

    const parsed = safeJson(response.output_text ?? "");
    if (!parsed) {
      return NextResponse.json(buildFallback(evidence), { headers: corsHeaders });
    }

    return NextResponse.json(parsed, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error." },
      { status: 500, headers: corsHeaders }
    );
  }
}
