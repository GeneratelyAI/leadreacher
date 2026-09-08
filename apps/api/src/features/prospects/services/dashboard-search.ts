import { z } from "zod";
import { DashboardSearchQuerySchema } from "../state/dashboard-search.js";
import { prisma } from "../../../platform/persistence/prisma.js";
import { leadSearchWhere, leadName } from "../public/presentation.js";

export async function searchDashboard(orgId: string, query: z.infer<typeof DashboardSearchQuerySchema>) {
  const [prospects, campaigns] = await Promise.all([
    prisma.lead.findMany({
      where: {
        orgId,
        ...leadSearchWhere(query.query),
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, firstName: true, lastName: true, company: true, avatarUrl: true },
    }),
    prisma.campaign.findMany({
      where: { orgId, name: { contains: query.query, mode: "insensitive" } },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true },
    }),
  ]);

  return ({
    prospects: prospects.map((prospect) => ({
      id: prospect.id,
      name: leadName(prospect),
      company: prospect.company,
      avatarUrl: prospect.avatarUrl,
    })),
    campaigns,
  });
}
