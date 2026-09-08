import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { inspectGraph } from "./graph.mjs";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sourceRoots = ["apps/web/src/", "apps/api/src/", "packages/shared/src/"];
const paths = [...new Set(git("ls-files", "--cached", "--others", "--exclude-standard").trim().split("\n"))]
  .filter((path) => /\.[cm]?[jt]sx?$|\.s?css$/.test(path))
  .filter((path) => sourceRoots.some((prefix) => path.startsWith(prefix)) || /^apps\/[^/]+\/e2e\//.test(path) || path.startsWith("packages/shared/tests/"))
  .filter((path) => existsSync(resolve(root, path))).sort();
const dependencies = inspectGraph(root, paths);
const report = {
  filesChecked: paths.length,
  unresolved: dependencies.unresolved,
  violations: dependencies.violations,
  cycles: dependencies.cycles,
  runtimeCycles: dependencies.runtimeCycles,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (process.argv.includes("--check") && (report.unresolved.length || report.violations.length || report.cycles.length)) process.exitCode = 1;
