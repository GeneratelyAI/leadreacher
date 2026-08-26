import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { evaluateAutofixDiff } from "../services/incident-autofix-policy.js";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const numstat = git("diff", "--numstat", "origin/develop");
const status = git("diff", "--name-status", "origin/develop");
const files: string[] = [];
let additions = 0;
let deletions = 0;
for (const line of numstat.split("\n").filter(Boolean)) {
  const [added, deleted, file] = line.split("\t");
  if (!file) continue;
  files.push(file);
  additions += /^\d+$/.test(added) ? Number(added) : 0;
  deletions += /^\d+$/.test(deleted) ? Number(deleted) : 0;
}
const deletedFiles = status.split("\n").filter((line) => line.startsWith("D\t"))
  .map((line) => line.slice(2));
const hasRegressionTest = files.some((file) =>
  /(?:^|\/)(?:__tests__\/.*|.*\.(?:test|spec)\.[cm]?[jt]sx?)$/.test(file),
);
const summary = { files, additions, deletions, deletedFiles, hasRegressionTest };
const decision = evaluateAutofixDiff(summary);
writeFileSync("artifacts/incident-policy.json", `${JSON.stringify({ summary, decision }, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `risk=${decision.risk}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `auto_merge_allowed=${decision.autoMergeAllowed}\n`);
}
if (files.length === 0) throw new Error("Codex produced no changes");
if (decision.risk === "prohibited") {
  throw new Error(`Incident autofix touched prohibited scope: ${decision.reasons.join("; ")}`);
}
