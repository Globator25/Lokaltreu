import { readFileSync } from "node:fs";
import * as ts from "typescript";

const sourcePath = "packages/types/src/index.ts";
const sourceText = readFileSync(sourcePath, "utf8");
const source = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

const requiredShapes = {
  createTokenReuseProblem: ["type", "title", "status", "detail", "error_code", "correlation_id"],
  createDeviceProofProblem: ["type", "title", "status", "detail", "error_code", "correlation_id"],
  createNotFoundProblem: ["type", "title", "status", "error_code", "correlation_id"],
  createInternalServerErrorProblem: ["type", "title", "status", "error_code", "correlation_id"],
};

const failures = [];

for (const [fnName, requiredKeys] of Object.entries(requiredShapes)) {
  let functionNode = null;

  source.forEachChild((node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) && node.name?.text === fnName) {
      functionNode = node;
    }
  });

  if (!functionNode) {
    failures.push(`Funktion ${fnName} nicht gefunden in ${sourcePath}.`);
    continue;
  }

  const objectLiterals = [];
  function visit(node) {
    if (ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)) {
      objectLiterals.push(node.expression);
    }
    node.forEachChild(visit);
  }
  functionNode.forEachChild(visit);

  if (objectLiterals.length === 0) {
    failures.push(`Funktion ${fnName} liefert kein Objektliteral zurück.`);
    continue;
  }

  for (const literal of objectLiterals) {
    const keys = new Set();
    for (const prop of literal.properties) {
      if (ts.isPropertyAssignment(prop)) {
        const name = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : undefined;
        if (name) keys.add(name);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        keys.add(prop.name.text);
      }
    }

    for (const required of requiredKeys) {
      if (!keys.has(required)) {
        failures.push(`Funktion ${fnName}: fehlendes Feld "${required}" in Problem+JSON.`);
      }
    }
  }
}

if (failures.length > 0) {
  for (const msg of failures) {
    console.error(msg);
  }
  process.exit(1);
}

console.log("Problem+JSON Lint erfolgreich: Pflichtfelder vorhanden.");
