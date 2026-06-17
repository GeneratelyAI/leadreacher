/**
 * Seed a single recipient lead for the live E2E test, WITH providerLinkedinId.
 *
 * Usage:
 *   pnpm --filter @leadreacher/api exec tsx src/scripts/seed-test-lead.ts \
 *     --org <orgId> --provider <providerLinkedinId> --url <linkedinUrl> \
 *     --first <firstName> --last <lastName> [--company <c>] [--title <t>]
 */
import { buildSeedLead, type SeedLeadInput } from "../lib/seed-lead.js";
import { prisma } from "../lib/prisma.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) {
    console.error(`✗ Missing required arg: --${name}`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const input: SeedLeadInput = {
    orgId: requireArg("org"),
    providerLinkedinId: requireArg("provider"),
    linkedinUrl: requireArg("url"),
    firstName: requireArg("first"),
    lastName: requireArg("last"),
    company: arg("company"),
    title: arg("title"),
  };

  const created = await prisma.lead.create({ data: buildSeedLead(input) });
  console.log(`✓ Seeded lead ${created.id} (provider_id ${input.providerLinkedinId})`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error("✗", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
