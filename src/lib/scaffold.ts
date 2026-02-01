import path from "path";
import { promises as fs } from "fs";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pascalCase(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function formatFields(fields: Spec["entities"][number]["fields"]) {
  return fields
    .map((field) => `- ${field.name} (${field.type})`)
    .join("\n");
}

export async function generateAppScaffold(workspace: string, spec: Spec) {
  const appRoot = path.join(workspace, "app");
  await fs.mkdir(appRoot, { recursive: true });

  const routes = spec.pages.length ? spec.pages : [
    { name: "Dashboard", purpose: "Overview and KPIs." },
    { name: "Items", purpose: "Manage records." },
  ];

  const pageIndex = `# ${spec.name}\n\n## Pages\n${routes
    .map((page) => `- ${page.name}: ${page.purpose}`)
    .join("\n")}\n\n## Entities\n${spec.entities
    .map(
      (entity) =>
        `### ${entity.name}\n${formatFields(entity.fields)}`
    )
    .join("\n\n")}\n`;

  await fs.writeFile(path.join(appRoot, "README.md"), pageIndex, "utf8");

  const appSpecPath = path.join(appRoot, "spec.json");
  await fs.writeFile(appSpecPath, JSON.stringify(spec, null, 2), "utf8");

  const uiMapPath = path.join(appRoot, "ui-map.md");
  await fs.writeFile(uiMapPath, pageIndex, "utf8");

  const pageDir = path.join(appRoot, "pages");
  await fs.mkdir(pageDir, { recursive: true });

  const pageArtifacts: string[] = [appSpecPath, uiMapPath];

  for (const page of routes) {
    const slug = slugify(page.name);
    const pagePath = path.join(pageDir, `${slug}.md`);
    const body = `# ${page.name}\n\nPurpose: ${page.purpose}\n`;
    await fs.writeFile(pagePath, body, "utf8");
    pageArtifacts.push(pagePath);
  }

  const apiDir = path.join(workspace, "backend");
  await fs.mkdir(apiDir, { recursive: true });

  for (const entity of spec.entities) {
    const fileName = `${slugify(entity.name)}.schema.json`;
    const schemaPath = path.join(apiDir, fileName);
    const schema = {
      name: entity.name,
      title: pascalCase(entity.name),
      fields: entity.fields,
    };
    await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");
    pageArtifacts.push(schemaPath);
  }

  const templateDir = path.join(appRoot, "template");
  await fs.mkdir(path.join(templateDir, "app"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "dashboard"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "records"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "entities"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "workflows"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "integrations"), {
    recursive: true,
  });
  await fs.mkdir(path.join(templateDir, "app", "auth"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "settings"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "api"), { recursive: true });
  await fs.mkdir(path.join(templateDir, "app", "api", "records"), {
    recursive: true,
  });
  await fs.mkdir(path.join(templateDir, "app", "api", "records", "[id]"), {
    recursive: true,
  });
  await fs.mkdir(path.join(templateDir, "app", "api", "entities"), {
    recursive: true,
  });

  const page = `"use client";

import { useMemo, useState } from "react";

type RecordItem = {
  id: string;
  title: string;
  status: "active" | "paused" | "complete";
  owner: string;
  updatedAt: string;
};

const seed: RecordItem[] = [
  {
    id: "rec-001",
    title: "Launch onboarding",
    status: "active",
    owner: "Avery",
    updatedAt: "2026-02-01",
  },
  {
    id: "rec-002",
    title: "Vendor audit",
    status: "paused",
    owner: "Riley",
    updatedAt: "2026-01-28",
  },
];

export default function DashboardPage() {
  const [items] = useState(seed);
  const metrics = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status === "active").length,
      paused: items.filter((item) => item.status === "paused").length,
    }),
    [items]
  );

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Generated App Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Generated from: ${spec.name}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Object.entries(metrics).map(([key, value]) => (
            <div
              key={key}
              className="rounded-2xl border border-white/10 bg-[#111522] p-5"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
                {key}
              </p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
          <h2 className="text-lg font-semibold">Latest records</h2>
          <div className="mt-4 space-y-3 text-sm text-zinc-300">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0c10] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="text-xs text-zinc-400">
                    Owner: {item.owner} - Updated {item.updatedAt}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200/40 bg-emerald-200/10 px-3 py-1 text-xs text-emerald-100">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

  const recordsPage = `"use client";

import { useEffect, useState } from "react";

type RecordItem = {
  id: string;
  title: string;
  status: string;
  owner: string;
};

const entities = ${JSON.stringify(spec.entities, null, 2)};

function sampleValue(field: { name: string; type: string }) {
  const name = field.name.toLowerCase();
  if (field.type === "number") return "1";
  if (field.type === "boolean") return "true";
  if (field.type === "date") return "2026-02-01";
  if (name.includes("status")) return "active";
  if (name.includes("name")) return "Sample";
  return "value";
}

export default function RecordsPage() {
  const [items, setItems] = useState<RecordItem[]>([]);
  const firstEntity = entities[0];

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Records</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage core data entities for ${spec.name}
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No records yet. Add your first item.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0c10] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">{item.title}</p>
                    <p className="text-xs text-zinc-400">
                      Owner: {item.owner}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {entities.map((entity) => (
            <div
              key={entity.name}
              className="rounded-3xl border border-white/10 bg-[#0f1320] p-5"
            >
              <h2 className="text-lg font-semibold">{entity.name}</h2>
              <p className="mt-1 text-xs text-zinc-400">
                Fields: {entity.fields.map((field) => field.name).join(", ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {entity.fields.map((field) => (
                  <span
                    key={field.name}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70"
                  >
                    {field.name}: {field.type}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {firstEntity && (
          <div className="mt-10 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
            <h2 className="text-lg font-semibold">
              {firstEntity.name} preview
            </h2>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-left text-sm text-zinc-300">
                <thead className="text-xs uppercase tracking-[0.2em] text-white/60">
                  <tr>
                    {firstEntity.fields.map((field) => (
                      <th key={field.name} className="px-3 py-2">
                        {field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1].map((row) => (
                    <tr key={row} className="border-t border-white/10">
                      {firstEntity.fields.map((field) => (
                        <td key={field.name} className="px-3 py-2">
                          {sampleValue(field)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

  const apiList = `import { NextResponse } from "next/server";

const items = [
  { id: "rec-001", title: "Launch onboarding", status: "active", owner: "Avery" },
  { id: "rec-002", title: "Vendor audit", status: "paused", owner: "Riley" },
];

export async function GET() {
  return NextResponse.json({ items });
}
`;

  const apiItem = `import { NextResponse } from "next/server";

const items = [
  { id: "rec-001", title: "Launch onboarding", status: "active", owner: "Avery" },
  { id: "rec-002", title: "Vendor audit", status: "paused", owner: "Riley" },
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const item = items.find((record) => record.id === params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}
`;

  const entityIndex = `import { NextResponse } from "next/server";

const entities = ${JSON.stringify(spec.entities, null, 2)};

export async function GET() {
  return NextResponse.json({ entities });
}
`;

  const layout = `import "../globals.css";

export default function TemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#0b0c10] text-white">{children}</div>;
}
`;

  const globals = `@import "tailwindcss";

:root {
  --background: #0b0c10;
  --foreground: #f2f5f7;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: system-ui, sans-serif;
}
`;

  const entityRoutes = spec.entities
    .map((entity) => `- /entities/${slugify(entity.name)}`)
    .join("\n");

  const readme = `# Generated Next App\n\nThis is a generated template for ${spec.name}.\n\n## Routes\n- /dashboard\n- /records\n- /entities\n- /workflows\n- /integrations\n- /auth\n- /settings\n${entityRoutes ? `${entityRoutes}\n` : ""}- /api/records\n- /api/records/[id]\n- /api/entities\n- /api/workflows\n- /api/integrations\n`;

  const templateArtifacts = [
    path.join(templateDir, "app", "dashboard", "page.tsx"),
    path.join(templateDir, "app", "records", "page.tsx"),
    path.join(templateDir, "app", "entities", "page.tsx"),
    path.join(templateDir, "app", "workflows", "page.tsx"),
    path.join(templateDir, "app", "integrations", "page.tsx"),
    path.join(templateDir, "app", "auth", "page.tsx"),
    path.join(templateDir, "app", "settings", "page.tsx"),
    path.join(templateDir, "app", "api", "records", "route.ts"),
    path.join(templateDir, "app", "api", "records", "[id]", "route.ts"),
    path.join(templateDir, "app", "api", "entities", "route.ts"),
    path.join(templateDir, "app", "api", "workflows", "route.ts"),
    path.join(templateDir, "app", "api", "integrations", "route.ts"),
    path.join(templateDir, "app", "layout.tsx"),
    path.join(templateDir, "globals.css"),
    path.join(templateDir, "README.md"),
  ];

  const entitiesPage = `"use client";

const entities = ${JSON.stringify(spec.entities, null, 2)};

export default function EntitiesPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Entities</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Base data models extracted from the prompt.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {entities.map((entity) => (
            <div
              key={entity.name}
              className="rounded-3xl border border-white/10 bg-[#0f1320] p-6"
            >
              <h2 className="text-lg font-semibold">{entity.name}</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                {entity.fields.map((field) => (
                  <li key={field.name} className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70">
                      {field.type}
                    </span>
                    <span>{field.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

  const workflowsPage = `"use client";

const workflows = ${JSON.stringify(spec.workflows, null, 2)};

export default function WorkflowsPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Workflows</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Automated flows generated from the prompt.
        </p>

        <div className="mt-8 space-y-6">
          {workflows.map((flow) => (
            <div
              key={flow.name}
              className="rounded-3xl border border-white/10 bg-[#0f1320] p-6"
            >
              <h2 className="text-lg font-semibold">{flow.name}</h2>
              <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                {flow.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="text-emerald-200/70">
                      0{index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

  const integrationsPage = `"use client";

const integrations = ${JSON.stringify(spec.integrations, null, 2)};

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Integrations</h1>
        <p className="mt-2 text-sm text-zinc-400">
          External systems connected to this app.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="rounded-3xl border border-white/10 bg-[#0f1320] p-6"
            >
              <h2 className="text-lg font-semibold">{integration.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">
                {integration.purpose}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

  const workflowsApi = `import { NextResponse } from "next/server";

const workflows = ${JSON.stringify(spec.workflows, null, 2)};

export async function GET() {
  return NextResponse.json({ workflows });
}
`;

  const integrationsApi = `import { NextResponse } from "next/server";

const integrations = ${JSON.stringify(spec.integrations, null, 2)};

export async function GET() {
  return NextResponse.json({ integrations });
}
`;

  const authPage = `"use client";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Access & Roles</h1>
        <p className="mt-3 text-sm text-zinc-400">
          This is a placeholder for Auth.js + RBAC integration. Replace with
          your identity provider (Okta, Azure AD, Google Workspace) and role
          policies.
        </p>
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
          <p className="text-sm text-zinc-300">
            Recommended roles:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>Admin - full access</li>
            <li>Manager - workflow + approvals</li>
            <li>Contributor - data updates</li>
            <li>Viewer - read only</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
`;

  const settingsPage = `"use client";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Configure environment variables, data retention, and notifications.
        </p>
        <div className="mt-6 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
          <p className="text-sm text-zinc-300">Environment</p>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>DATABASE_URL</li>
            <li>AUTH_PROVIDER</li>
            <li>NOTIFICATION_WEBHOOK</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
`;

  await fs.writeFile(templateArtifacts[0], page, "utf8");
  await fs.writeFile(templateArtifacts[1], recordsPage, "utf8");
  await fs.writeFile(templateArtifacts[2], entitiesPage, "utf8");
  await fs.writeFile(templateArtifacts[3], workflowsPage, "utf8");
  await fs.writeFile(templateArtifacts[4], integrationsPage, "utf8");
  await fs.writeFile(templateArtifacts[5], authPage, "utf8");
  await fs.writeFile(templateArtifacts[6], settingsPage, "utf8");
  await fs.writeFile(templateArtifacts[7], apiList, "utf8");
  await fs.writeFile(templateArtifacts[8], apiItem, "utf8");
  await fs.writeFile(templateArtifacts[9], entityIndex, "utf8");
  await fs.writeFile(templateArtifacts[10], workflowsApi, "utf8");
  await fs.writeFile(templateArtifacts[11], integrationsApi, "utf8");
  await fs.writeFile(templateArtifacts[12], layout, "utf8");
  await fs.writeFile(templateArtifacts[13], globals, "utf8");
  await fs.writeFile(templateArtifacts[14], readme, "utf8");

  for (const entity of spec.entities) {
    const slug = slugify(entity.name);
    const entityDir = path.join(templateDir, "app", "api", slug);
    const entityIdDir = path.join(entityDir, "[id]");
    await fs.mkdir(entityDir, { recursive: true });
    await fs.mkdir(entityIdDir, { recursive: true });

    const listRoute = `import { NextResponse } from "next/server";

const items = [
  { id: "1", name: "${entity.name} Sample", status: "active" },
];

export async function GET() {
  return NextResponse.json({ items });
}
`;

    const detailRoute = `import { NextResponse } from "next/server";

const items = [
  { id: "1", name: "${entity.name} Sample", status: "active" },
];

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const item = items.find((record) => record.id === params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}
`;

    const listPath = path.join(entityDir, "route.ts");
    const detailPath = path.join(entityIdDir, "route.ts");
    await fs.writeFile(listPath, listRoute, "utf8");
    await fs.writeFile(detailPath, detailRoute, "utf8");
    templateArtifacts.push(listPath, detailPath);

    const entityPageDir = path.join(templateDir, "app", "entities", slug);
    await fs.mkdir(entityPageDir, { recursive: true });
    const entityPagePath = path.join(entityPageDir, "page.tsx");
    const entityPage = `"use client";

import { useEffect, useState } from "react";

type Row = { [key: string]: string };

export default function ${pascalCase(entity.name)}Page() {
  const [items, setItems] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/${slug}")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []));
  }, []);

  const fields = ${JSON.stringify(entity.fields, null, 2)};

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-semibold">${entity.name}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Auto-generated list view for ${entity.name}.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-[#0f1320] p-6">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No ${entity.name} records found.
            </p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-left text-sm text-zinc-300">
                <thead className="text-xs uppercase tracking-[0.2em] text-white/60">
                  <tr>
                    {fields.map((field) => (
                      <th key={field.name} className="px-3 py-2">
                        {field.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t border-white/10">
                      {fields.map((field) => (
                        <td key={field.name} className="px-3 py-2">
                          {String(item[field.name] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`;

    await fs.writeFile(entityPagePath, entityPage, "utf8");
    templateArtifacts.push(entityPagePath);
  }

  return pageArtifacts.concat(templateArtifacts);
}
