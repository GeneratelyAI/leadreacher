import { ZipArchive } from "archiver";
import { PassThrough } from "node:stream";
import { R2Adapter } from "../adapters/r2.js";
import { prisma } from "../lib/prisma.js";
import { enqueueProductEmail } from "./product-email-outbox.js";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (!keys.length) return "";
  return [keys.map(csvCell).join(","), ...rows.map((row) => keys.map((key) => csvCell(row[key])).join(","))].join("\n");
}

async function zipFiles(files: Array<{ name: string; content: string }>): Promise<Buffer> {
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    output.on("end", () => resolve(Buffer.concat(chunks)));
    output.on("error", reject);
  });
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("error", (error: Error) => output.destroy(error));
  archive.pipe(output);
  for (const file of files) archive.append(file.content, { name: file.name });
  await archive.finalize();
  return completed;
}

export async function processOrganizationExports(limit = 3): Promise<{ processed: number }> {
  const jobs = await prisma.organizationExportJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const r2 = new R2Adapter();
  let processed = 0;

  for (const job of jobs) {
    const claimed = await prisma.organizationExportJob.updateMany({
      where: { id: job.id, status: "pending" },
      data: { status: "processing", error: null },
    });
    if (!claimed.count) continue;

    try {
      const [organization, users, campaigns, leads, messages, socialAccounts, videos, auditLogs] = await Promise.all([
        prisma.organization.findUniqueOrThrow({ where: { id: job.orgId } }),
        prisma.user.findMany({ where: { orgId: job.orgId } }),
        prisma.campaign.findMany({ where: { orgId: job.orgId } }),
        prisma.lead.findMany({ where: { orgId: job.orgId } }),
        prisma.message.findMany({ where: { orgId: job.orgId } }),
        prisma.socialAccount.findMany({ where: { orgId: job.orgId } }),
        prisma.videoAsset.findMany({ where: { orgId: job.orgId } }),
        prisma.auditLog.findMany({ where: { orgId: job.orgId } }),
      ]);
      const mediaManifest = videos.flatMap((video) => [video.videoUrl, video.thumbnailUrl, video.seedImageUrl].filter(Boolean));
      const archive = await zipFiles([
        { name: "organization.json", content: JSON.stringify({ organization, users, socialAccounts }, null, 2) },
        { name: "campaigns.csv", content: toCsv(campaigns as unknown as Array<Record<string, unknown>>) },
        { name: "prospects.csv", content: toCsv(leads as unknown as Array<Record<string, unknown>>) },
        { name: "messages.csv", content: toCsv(messages as unknown as Array<Record<string, unknown>>) },
        { name: "audit-log.json", content: JSON.stringify(auditLogs, null, 2) },
        { name: "media-manifest.json", content: JSON.stringify(mediaManifest, null, 2) },
      ]);
      const objectKey = `exports/${job.orgId}/${job.id}.zip`;
      await r2.uploadBuffer(objectKey, archive, "application/zip");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.organizationExportJob.update({
        where: { id: job.id },
        data: { status: "ready", objectKey, expiresAt, manifest: { media: mediaManifest.length } },
      });
      const owner = users.find((user) => user.id === job.requestedById) ?? users.find((user) => user.role === "owner");
      if (owner) {
        await enqueueProductEmail({
          orgId: job.orgId,
          idempotencyKey: `export-ready:${job.id}`,
          template: "export_ready",
          recipient: owner.email,
          subject: "Your LeadReacher export is ready",
          text: "Your organization export is ready for download in Settings. The download expires in 24 hours.",
        });
      }
      processed += 1;
    } catch (error) {
      await prisma.organizationExportJob.update({
        where: { id: job.id },
        data: { status: "failed", error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000) },
      });
    }
  }
  return { processed };
}
