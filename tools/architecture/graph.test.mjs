import assert from "node:assert/strict";
import { test } from "node:test";
import { boundaryViolation, references, stronglyConnected } from "./graph.mjs";

test("detects static, dynamic, re-export and mock references", () => {
  const result = references("example.ts", `import type { A } from './a.js'; export { B } from './b.js'; import('./c.js'); vi.mock('./d.js'); import(variable);`);
  assert.deepEqual(result.imports.map(({ name }) => name), ["./a.js", "./b.js", "./c.js", "./d.js"]);
  assert.equal(result.imports[0].typeOnly, true);
  assert.equal(result.dynamic.length, 1);
});

test("finds cycles including self references but not a diamond", () => {
  const graph = new Map([["a", ["b", "c"]], ["b", ["d"]], ["c", ["d"]], ["d", []]]);
  assert.deepEqual(stronglyConnected(graph), []);
  graph.set("d", ["a"]);
  assert.deepEqual(stronglyConnected(graph), [["a", "b", "c", "d"]]);
  assert.deepEqual(stronglyConnected(new Map([["a", ["a"]]])), [["a"]]);
});

test("inventories declared HTTP routes rather than Map, Redis, or outbound provider calls", () => {
  const result = references("routes.ts", `r.get('/dashboard', {}, handler); app.post('/auth/bootstrap', {}, handler); map.get('/cache'); redis.get(key); provider.post('/remote', payload); r.get(variable, {}, handler);`);
  assert.deepEqual(result.endpoints.map(({ method, path }) => ({ method, path })), [
    { method: "get", path: "/dashboard" },
    { method: "post", path: "/auth/bootstrap" },
  ]);
});

test("requires explicit public modules and prevents reverse platform dependencies", () => {
  const target = "apps/web/src/features/campaigns/public/summary.ts";
  assert.equal(boundaryViolation("apps/web/src/features/onboarding/flow.ts", target), null);
  assert.equal(boundaryViolation("apps/web/src/platform/http/client.ts", target), "platform-imports-feature");
  assert.equal(boundaryViolation("apps/web/src/app/page.tsx", target.replace("public/", "state/")), "private-feature-import");
  assert.equal(boundaryViolation("apps/web/src/features/campaigns/flow.ts", target.replace("public/", "state/")), null);
});
