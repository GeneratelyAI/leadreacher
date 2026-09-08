import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
export const ts = require("typescript");

export function references(path, source) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  const dynamic = [];
  const endpoints = [];
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      imports.push({ name: node.moduleSpecifier.text, typeOnly: Boolean(node.isTypeOnly || node.importClause?.isTypeOnly) });
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(file);
      if (name === "require" || name === "import" || /^(vi|jest)\.(mock|doMock|unmock)$/.test(name)) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument)) imports.push({ name: argument.text, typeOnly: false });
        else dynamic.push({ expression: node.getText(file), line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      }
      if (/^(app|r|fastify|instance)\.(get|post|put|patch|delete|options|head)$/.test(name)) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteralLike(argument) && argument.text.startsWith("/")) {
          endpoints.push({ method: name.split(".").at(-1), path: argument.text, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { imports, dynamic, endpoints };
}

export function stronglyConnected(graph) {
  const seen = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const cycles = [];
  let index = 0;
  function visit(node) {
    seen.set(node, index);
    low.set(node, index++);
    stack.push(node);
    active.add(node);
    for (const target of graph.get(node) ?? []) {
      if (!seen.has(target)) {
        visit(target);
        low.set(node, Math.min(low.get(node), low.get(target)));
      } else if (active.has(target)) low.set(node, Math.min(low.get(node), seen.get(target)));
    }
    if (low.get(node) !== seen.get(node)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1 || graph.get(node)?.includes(node)) cycles.push(component.sort());
  }
  for (const node of graph.keys()) if (!seen.has(node)) visit(node);
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

export function boundaryViolation(from, to) {
  const source = from.match(/^(apps\/[^/]+)\/src\/(features|platform)\/([^/]+)/);
  const target = to.match(/^(apps\/[^/]+)\/src\/features\/([^/]+)\/(.*)$/);
  if (!target) return null;
  if (source?.[2] === "platform") return "platform-imports-feature";
  if (source?.[1] === target[1] && source[2] === "features" && source[3] === target[2]) return null;
  return /^public\/[^/]+\.[cm]?[jt]sx?$/.test(target[3]) ? null : "private-feature-import";
}

export function inspectGraph(root, files) {
  const graph = new Map();
  const runtimeGraph = new Map();
  const unresolved = [];
  const violations = [];
  const dynamic = [];
  const endpoints = [];
  const configs = new Map();
  for (const path of files.filter((p) => /\.[cm]?[jt]sx?$/.test(p))) {
    const app = path.startsWith("packages/") ? "packages/shared" : path.split("/").slice(0, 2).join("/");
    if (!configs.has(app)) {
      const configPath = resolve(root, app, "tsconfig.json");
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      if (config.error) throw new Error(`Cannot read ${configPath}`);
      configs.set(app, ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath)).options);
    }
    const refs = references(path, readFileSync(resolve(root, path), "utf8"));
    dynamic.push(...refs.dynamic.map((item) => ({ file: path, ...item })));
    if (path.startsWith("apps/api/") && !/\/(__tests__|integration)\/|\.(test|spec)\./.test(path)) {
      endpoints.push(...refs.endpoints.map((item) => ({ file: path, ...item })));
    }
    const edges = [];
    const runtimeEdges = [];
    for (const item of refs.imports) {
      const resolved = ts.resolveModuleName(item.name, resolve(root, path), configs.get(app), ts.sys).resolvedModule;
      if (!resolved) {
        if (item.name.startsWith(".") || item.name.startsWith("@/")) {
          const asset = item.name.startsWith("@/") ? resolve(root, app, "src", item.name.slice(2)) : resolve(root, dirname(path), item.name);
          if (!existsSync(asset)) unresolved.push({ file: path, import: item.name });
        }
        continue;
      }
      if (resolved.isExternalLibraryImport) continue;
      const target = relative(root, resolved.resolvedFileName);
      edges.push(target);
      if (!item.typeOnly) runtimeEdges.push(target);
      const rule = boundaryViolation(path, target);
      if (rule) violations.push({ from: path, to: target, rule });
    }
    graph.set(path, [...new Set(edges)]);
    runtimeGraph.set(path, [...new Set(runtimeEdges)]);
  }
  return {
    unresolved, violations, cycles: stronglyConnected(graph), runtimeCycles: stronglyConnected(runtimeGraph),
    dynamic, endpoints, imports: Object.fromEntries(graph),
  };
}
