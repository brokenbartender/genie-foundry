import path from "path";
import { promises as fs } from "fs";
import OpenAI from "openai";

type Spec = {
  name: string;
  domain: string;
  entities: Array<{
    name: string;
    fields: Array<{ name: string; type: string; required: boolean }>;
  }>;
  workflows: Array<{ name: string; steps: string[] }>;
  integrations: Array<{ name: string; purpose: string }>;
  pages: Array<{ name: string; purpose: string }>;
};

function pascalCase(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapFieldType(type: string) {
  switch (type) {
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "string";
    case "text":
      return "string";
    case "enum":
      return "string";
    default:
      return "string";
  }
}

function buildSchema(spec: Spec) {
  const schemas = spec.entities.map((entity) => {
    const required = entity.fields
      .filter((field) => field.required)
      .map((field) => field.name);
    const properties = entity.fields.reduce<Record<string, unknown>>(
      (acc, field) => {
        acc[field.name] = { type: mapFieldType(field.type) };
        return acc;
      },
      {}
    );
    return {
      name: entity.name,
      schema: {
        type: "object",
        properties,
        required,
      },
    };
  });

  return schemas;
}

function buildUiMarkdown(spec: Spec) {
  return `# ${spec.name}\n\n## Pages\n${spec.pages
    .map((page) => `- ${page.name}: ${page.purpose}`)
    .join("\n")}\n\n## Entities\n${spec.entities
    .map(
      (entity) =>
        `- ${entity.name}: ${entity.fields
          .map((field) => `${field.name} (${field.type})`)
          .join(", ")}`
    )
    .join("\n")}\n`;
}

export async function generateScaffold(
  workspace: string,
  spec: Spec
): Promise<string[]> {
  const artifacts: string[] = [];
  const appDir = path.join(workspace, "app");
  const backendDir = path.join(workspace, "backend");
  const infraDir = path.join(workspace, "infra");

  await fs.mkdir(appDir, { recursive: true });
  await fs.mkdir(backendDir, { recursive: true });
  await fs.mkdir(infraDir, { recursive: true });

  const schema = buildSchema(spec);
  const schemaPath = path.join(backendDir, "data-schema.json");
  await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");
  artifacts.push(schemaPath);

  const uiPath = path.join(appDir, "ui-map.md");
  await fs.writeFile(uiPath, buildUiMarkdown(spec), "utf8");
  artifacts.push(uiPath);

  const integrationsPath = path.join(infraDir, "integrations.json");
  await fs.writeFile(
    integrationsPath,
    JSON.stringify(spec.integrations, null, 2),
    "utf8"
  );
  artifacts.push(integrationsPath);

  const workflowPath = path.join(backendDir, "workflows.json");
  await fs.writeFile(
    workflowPath,
    JSON.stringify(spec.workflows, null, 2),
    "utf8"
  );
  artifacts.push(workflowPath);

  const metaPath = path.join(workspace, "meta.json");
  await fs.writeFile(
    metaPath,
    JSON.stringify(
      {
        name: spec.name,
        domain: spec.domain,
        slug: safeName(spec.name),
        entities: spec.entities.map((entity) => pascalCase(entity.name)),
      },
      null,
      2
    ),
    "utf8"
  );
  artifacts.push(metaPath);

  return artifacts;
}

type CodegenTarget = {
  path: string;
  description: string;
  kind: "page" | "layout" | "api" | "config";
};

const CODEGEN_SYSTEM = `You are a senior Next.js engineer.
Follow these rules strictly:
- Use Next.js App Router (app/ directory). No pages/ directory.
- Use TypeScript and React 18+.
- For client components, include "use client" at top.
- Return ONLY JSON with keys: "path", "content".
- Content must be valid TypeScript/TSX or JSON depending on file.
- No markdown, no extra commentary.`;

const CODEGEN_SCHEMA = {
  name: "codegen_file",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      path: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "content"],
  },
} as const;

function getCodegenTargets(spec: Spec): CodegenTarget[] {
  const targets: CodegenTarget[] = [
    {
      path: "app/layout.tsx",
      description:
        "Root layout with basic shell and navigation links for dashboard, records, entities, workflows, integrations, auth, settings.",
      kind: "layout",
    },
    {
      path: "app/page.tsx",
      description:
        "Landing page for the generated app with summary and links to sections.",
      kind: "page",
    },
    { path: "app/dashboard/page.tsx", description: "Dashboard page", kind: "page" },
    { path: "app/records/page.tsx", description: "Records page", kind: "page" },
    { path: "app/entities/page.tsx", description: "Entities page", kind: "page" },
    { path: "app/workflows/page.tsx", description: "Workflows page", kind: "page" },
    {
      path: "app/integrations/page.tsx",
      description: "Integrations page",
      kind: "page",
    },
    { path: "app/auth/page.tsx", description: "Auth + RBAC page", kind: "page" },
    {
      path: "app/settings/page.tsx",
      description: "Settings page",
      kind: "page",
    },
    {
      path: "app/api/entities/route.ts",
      description: "Returns entities from spec.",
      kind: "api",
    },
    {
      path: "app/api/workflows/route.ts",
      description: "Returns workflows from spec.",
      kind: "api",
    },
    {
      path: "app/api/integrations/route.ts",
      description: "Returns integrations from spec.",
      kind: "api",
    },
  ];

  for (const entity of spec.entities) {
    const slug = safeName(entity.name);
    targets.push(
      {
        path: `app/api/${slug}/route.ts`,
        description: `List endpoint for ${entity.name}.`,
        kind: "api",
      },
      {
        path: `app/api/${slug}/[id]/route.ts`,
        description: `Detail endpoint for ${entity.name}.`,
        kind: "api",
      },
      {
        path: `app/entities/${slug}/page.tsx`,
        description: `Entity list page for ${entity.name}.`,
        kind: "page",
      }
    );
  }

  return targets;
}

function validateCode(content: string, ext: string): string | null {
  if (ext === ".json") {
    try {
      JSON.parse(content);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }

  const pairs: Record<string, string> = {
    "(": ")",
    "{": "}",
    "[": "]",
  };
  const stack: string[] = [];
  let inString: string | null = null;
  let escape = false;

  for (const char of content) {
    if (escape) {
      escape = false;
      continue;
    }
    if (char === "\\") {
      escape = true;
      continue;
    }
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    if (pairs[char]) {
      stack.push(pairs[char]);
    } else if (Object.values(pairs).includes(char)) {
      const expected = stack.pop();
      if (expected !== char) {
        return `Mismatched token: expected ${expected ?? "none"} but found ${char}`;
      }
    }
  }

  if (stack.length > 0) {
    return "Unbalanced brackets detected";
  }

  return null;
}

async function generateFileWithLLM(
  client: OpenAI,
  spec: Spec,
  target: CodegenTarget,
  outputRoot: string,
  attempt = 1,
  errorMessage?: string
): Promise<string> {
  const prompt = [
    `Project: ${spec.name}`,
    `Domain: ${spec.domain}`,
    `Entities: ${spec.entities.map((e) => e.name).join(", ")}`,
    `Workflows: ${spec.workflows.map((w) => w.name).join(", ")}`,
    `Integrations: ${spec.integrations.map((i) => i.name).join(", ")}`,
    `Task: Generate ${target.kind} file at ${target.path}`,
    `Description: ${target.description}`,
    `Spec (JSON): ${JSON.stringify(spec, null, 2)}`,
  ];

  if (errorMessage) {
    prompt.push(`Fix validation error: ${errorMessage}`);
  }

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      { role: "system", content: CODEGEN_SYSTEM },
      { role: "user", content: prompt.join("\n") },
    ],
    text: {
      format: {
        type: "json_schema",
        ...CODEGEN_SCHEMA,
      },
    },
  });

  const payload = JSON.parse(response.output_text ?? "{}") as {
    path?: string;
    content?: string;
  };

  const content = payload.content ?? "";
  const ext = path.extname(target.path);
  const validation = validateCode(content, ext);
  if (validation && attempt < 2) {
    return generateFileWithLLM(
      client,
      spec,
      target,
      outputRoot,
      attempt + 1,
      validation
    );
  }

  const fullPath = path.join(outputRoot, target.path);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf8");
  return fullPath;
}

export async function generateAppCode(
  workspace: string,
  spec: Spec
): Promise<string[]> {
  const outputRoot = path.join(workspace, "app", "full");
  await fs.mkdir(outputRoot, { recursive: true });

  const baseFiles: Array<{ path: string; content: string }> = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: safeName(spec.name) || "generated-app",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
          },
          dependencies: {
            next: "16.1.6",
            react: "19.2.3",
            "react-dom": "19.2.3",
          },
          devDependencies: {
            typescript: "^5",
            eslint: "^9",
            "eslint-config-next": "16.1.6",
          },
        },
        null,
        2
      ),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
          exclude: ["node_modules"],
        },
        null,
        2
      ),
    },
    {
      path: "next-env.d.ts",
      content:
        "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n",
    },
  ];

  const artifacts: string[] = [];
  for (const file of baseFiles) {
    const fullPath = path.join(outputRoot, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, "utf8");
    artifacts.push(fullPath);
  }

  const client = new OpenAI();
  const targets = getCodegenTargets(spec);
  for (const target of targets) {
    const fullPath = await generateFileWithLLM(
      client,
      spec,
      target,
      outputRoot
    );
    artifacts.push(fullPath);
  }

  return artifacts;
}
