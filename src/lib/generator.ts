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
