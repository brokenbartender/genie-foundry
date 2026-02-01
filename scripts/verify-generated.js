/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "generated");

if (!fs.existsSync(root)) {
  console.error("No generated directory found.");
  process.exit(1);
}

const runs = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (runs.length === 0) {
  console.error("No generated runs found.");
  process.exit(1);
}

const latest = runs.sort().slice(-1)[0];
const workspace = path.join(root, latest);

const expected = [
  "manifest.json",
  "app-spec.json",
  path.join("app", "template", "app", "dashboard", "page.tsx"),
  path.join("app", "template", "app", "records", "page.tsx"),
  path.join("app", "template", "app", "entities", "page.tsx"),
  path.join("app", "template", "app", "workflows", "page.tsx"),
  path.join("app", "template", "app", "integrations", "page.tsx"),
  path.join("app", "template", "app", "auth", "page.tsx"),
  path.join("app", "template", "app", "settings", "page.tsx"),
  path.join("app", "template", "app", "api", "records", "route.ts"),
  path.join("app", "template", "app", "api", "records", "[id]", "route.ts"),
  path.join("app", "template", "app", "api", "entities", "route.ts"),
  path.join("app", "template", "app", "api", "workflows", "route.ts"),
  path.join("app", "template", "app", "api", "integrations", "route.ts"),
];

const missing = expected.filter(
  (relPath) => !fs.existsSync(path.join(workspace, relPath))
);

if (missing.length > 0) {
  console.error("Missing generated artifacts:");
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log("Generated artifacts look good.");
