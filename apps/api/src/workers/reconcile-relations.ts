import { UnipileAdapter } from "../adapters/unipile.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { LEAD_STATUS_CONNECTED } from "../lib/lead-status.js";
import { parseSequence } from "../lib/sequence.js";
import { leadLinkedinIdentifier } from "../lib/linkedin-identifier.js";
import { resolveProviderId } from "../lib/provider-id.js";
import { logOperationalInfo } from "../lib/operational-logger.js";
import { isConnectedProfile } from "../lib/relation-status.js";
import { deliverSequenceStep1ViaChat } from "../services/campaign-step1-chat.js";

// Bound each run so a backlog can't hammer LinkedIn (ban risk) in one sweep.
const RECONCILE_BATCH_SIZE = 50;
const RECONCILE_WINDOW_DAYS = 14;

function loadCandidates() {
  const cutoff = new Date(
    Date.now() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  // Invite sent (currentStep 1), still awaiting the relation.new webhook
  // (no chat yet), within the polling window.
  return prisma.campaignLead.findMany({
    where: {
      status: "active",
      currentStep: 1,
      linkedinChatId: null,
      createdAt: { gte: cutoff },
    },
    take: RECONCILE_BATCH_SIZE,
    include: { lead: true, campaign: true },
  });
}

type Candidate = Awaited<ReturnType<typeof loadCandidates>>[number];

async function resolveUnipileId(
  cache: Map<string, string | null>,
  orgId: string,
): Promise<string | null> {
  if (cache.has(orgId)) {
    return cache.get(orgId) ?? null;
  }
  const account = await prisma.socialAccount.findFirst({
    where: { orgId, platform: "linkedin", status: "active" },
  });
  const unipileId = account?.unipileId ?? null;
  cache.set(orgId, unipileId);
  return unipileId;
}

async function reconcileCandidate(
  adapter: UnipileAdapter,
  cache: Map<string, string | null>,
  candidate: Candidate,
): Promise<boolean> {
  const orgId = candidate.campaign.orgId;
  const unipileId = await resolveUnipileId(cache, orgId);
  if (!unipileId) {
    return false;
  }

  const identifier = leadLinkedinIdentifier(candidate.lead);
  if (!identifier) {
    return false;
  }

  let profile;
  try {
    profile = await adapter.getProfile(unipileId, identifier);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "reconcile-relations",
        path: "getProfile-failed",
        campaignLeadId: candidate.id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }

  if (!isConnectedProfile(profile)) {
    return false;
  }

  const attendeeProviderId = resolveProviderId(
    candidate.lead.providerLinkedinId,
    profile.provider_id,
  );
  if (!attendeeProviderId) {
    return false;
  }

  await prisma.lead.update({
    where: { id: candidate.leadId },
    data: {
      status: LEAD_STATUS_CONNECTED,
      ...(candidate.lead.providerLinkedinId
        ? {}
        : { providerLinkedinId: attendeeProviderId }),
    },
  });

  // deliverSequenceStep1ViaChat is idempotent (linkedinChatId unique guard),
  // so a racing relation.new webhook will not double-send.
  await deliverSequenceStep1ViaChat({
    adapter,
    campaignLeadId: candidate.id,
    orgId,
    campaignId: candidate.campaignId,
    leadId: candidate.leadId,
    attendeeProviderId,
    unipileAccountId: unipileId,
    sequence: parseSequence(candidate.campaign.sequence),
    existingChatId: candidate.linkedinChatId,
  });

  logOperationalInfo("reconcile-relations", {
    path: "advanced-to-step1",
    campaignLeadId: candidate.id,
  });
  return true;
}

/**
 * Poll-based fallback for the `relation.new` webhook: for invites that have
 * been accepted but whose webhook lagged or never fired, detect the connection
 * via getProfile and advance the lead to step 1.
 */
export async function reconcilePendingConnections(): Promise<{
  checked: number;
  advanced: number;
}> {
  const candidates = await loadCandidates();
  if (candidates.length === 0) {
    return { checked: 0, advanced: 0 };
  }

  const adapter = new UnipileAdapter({
    apiKey: env.UNIPILE_API_KEY,
  });
  const unipileIdByOrg = new Map<string, string | null>();

  let advanced = 0;
  for (const candidate of candidates) {
    if (await reconcileCandidate(adapter, unipileIdByOrg, candidate)) {
      advanced += 1;
    }
  }

  return { checked: candidates.length, advanced };
}
