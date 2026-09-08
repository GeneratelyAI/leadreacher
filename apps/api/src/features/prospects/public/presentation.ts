import { type Prisma } from "@prisma/client";

export function leadName(lead: { firstName: string; lastName: string }): string {
  return `${lead.firstName} ${lead.lastName}`.trim() || "A prospect";
}

export function leadSearchWhere(rawQuery: string): Prisma.LeadWhereInput {
  const terms = rawQuery.trim().split(/\s+/).filter(Boolean);
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { title: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}
