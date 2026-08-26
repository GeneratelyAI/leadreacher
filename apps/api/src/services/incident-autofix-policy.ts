export const AUTOFIX_PROHIBITED_PREFIXES = [
  "apps/api/prisma/",
  ".github/",
  "infra/",
  "railway",
  "apps/api/src/routes/stripe",
  "apps/api/src/modules/billing",
  "apps/api/src/plugins/auth",
  "apps/api/src/routes/auth",
  "apps/api/src/lib/encryption",
] as const;

export const AUTOFIX_PROHIBITED_FILES = [
  "pnpm-lock.yaml",
  "package.json",
  "apps/api/package.json",
  "apps/web/package.json",
] as const;

export type AutofixDiffSummary = {
  files: string[];
  additions: number;
  deletions: number;
  deletedFiles: string[];
  hasRegressionTest: boolean;
};

export type AutofixPolicyDecision = {
  risk: "low" | "medium" | "high" | "prohibited";
  autoMergeAllowed: boolean;
  reasons: string[];
};

export function evaluateAutofixDiff(summary: AutofixDiffSummary): AutofixPolicyDecision {
  const reasons: string[] = [];
  const prohibitedPath = summary.files.find((file) =>
    AUTOFIX_PROHIBITED_FILES.includes(file as never)
    || AUTOFIX_PROHIBITED_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );
  if (prohibitedPath) reasons.push(`Prohibited path: ${prohibitedPath}`);
  if (summary.deletedFiles.length > 0) reasons.push("File deletion is not allowed");
  if (summary.files.length > 8) reasons.push("More than 8 files changed");
  if (summary.additions + summary.deletions > 350) reasons.push("More than 350 lines changed");
  if (!summary.hasRegressionTest) reasons.push("No regression test was added or updated");

  if (prohibitedPath || summary.deletedFiles.length > 0) {
    return { risk: "prohibited", autoMergeAllowed: false, reasons };
  }
  if (reasons.length > 0) return { risk: "high", autoMergeAllowed: false, reasons };
  return { risk: "low", autoMergeAllowed: true, reasons: [] };
}

