import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAPI_PATH = path.resolve(__dirname, "..", "apps", "api", "openapi", "lokaltreu-openapi-v2.0.yaml");
const OUTPUT_PATH = path.resolve(__dirname, "..", "packages", "types", "src", "index.d.ts");

function toLiteral(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "unknown";
}

function normalizeSchema(schema) {
  if (schema && typeof schema === "object" && !Array.isArray(schema)) {
    return schema;
  }
  return {};
}

function schemaToTs(schema, ctx) {
  const normalized = normalizeSchema(schema);
  if (normalized.$ref && typeof normalized.$ref === "string") {
    const match = normalized.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      return `components["schemas"]["${match[1]}"]`;
    }
  }

  if (Array.isArray(normalized.enum)) {
    const values = normalized.enum.map(toLiteral).filter((entry) => entry !== "unknown");
    if (values.length > 0) {
      let result = values.join(" | ");
      if (normalized.nullable) {
        result = `${result} | null`;
      }
      return result;
    }
  }

  if (Array.isArray(normalized.oneOf)) {
    const union = normalized.oneOf.map((item) => schemaToTs(item, ctx)).join(" | ");
    return normalized.nullable ? `${union} | null` : union;
  }

  if (Array.isArray(normalized.anyOf)) {
    const union = normalized.anyOf.map((item) => schemaToTs(item, ctx)).join(" | ");
    return normalized.nullable ? `${union} | null` : union;
  }

  if (Array.isArray(normalized.allOf)) {
    const intersection = normalized.allOf.map((item) => schemaToTs(item, ctx)).join(" & ");
    return normalized.nullable ? `${intersection} | null` : intersection;
  }

  if (normalized.type === "array") {
    const items = schemaToTs(normalized.items ?? {}, ctx);
    const result = `Array<${items}>`;
    return normalized.nullable ? `${result} | null` : result;
  }

  if (normalized.type === "object" || normalized.properties || normalized.additionalProperties) {
    const required = new Set(Array.isArray(normalized.required) ? normalized.required : []);
    const properties = normalizeSchema(normalized.properties);
    const keys = Object.keys(properties).sort();
    const lines = keys.map((key) => {
      const propSchema = properties[key];
      const optional = required.has(key) ? "" : "?";
      return `${key}${optional}: ${schemaToTs(propSchema, ctx)};`;
    });

    if (normalized.additionalProperties === true) {
      lines.push("[key: string]: unknown;");
    } else if (normalized.additionalProperties && typeof normalized.additionalProperties === "object") {
      lines.push(`[key: string]: ${schemaToTs(normalized.additionalProperties, ctx)};`);
    }

    const body = lines.length > 0 ? `{\n${lines.map((line) => `      ${line}`).join("\n")}\n    }` : "{}";
    return normalized.nullable ? `${body} | null` : body;
  }

  if (normalized.type === "string") {
    return normalized.nullable ? "string | null" : "string";
  }
  if (normalized.type === "integer" || normalized.type === "number") {
    return normalized.nullable ? "number | null" : "number";
  }
  if (normalized.type === "boolean") {
    return normalized.nullable ? "boolean | null" : "boolean";
  }

  return normalized.nullable ? "unknown | null" : "unknown";
}

function generateTypes(openapi) {
  const schemas = normalizeSchema(openapi?.components?.schemas);
  const schemaNames = Object.keys(schemas).sort();
  const lines = schemaNames.map((name) => {
    const schema = schemas[name];
    const type = schemaToTs(schema, {});
    return `    ${name}: ${type};`;
  });

  return `export interface components {\n  schemas: {\n${lines.join("\n")}\n  };\n}\n`;
}

async function main() {
  try {
    const raw = await fs.readFile(OPENAPI_PATH, "utf8");
    const openapi = parseYaml(raw);
    if (!openapi || typeof openapi !== "object") {
      throw new Error("OpenAPI parse failed");
    }
    const content = generateTypes(openapi);
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, content, "utf8");
  } catch (error) {
    console.error("OpenAPI type generation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();
