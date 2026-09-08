export type LinkedInCompanyHeadcountCode =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I";

type HeadcountBand = {
  code: LinkedInCompanyHeadcountCode;
  min: number;
  max: number | null;
};

/**
 * HarvestAPI's LinkedIn profile actor calls this filter `companyHeadcount`;
 * the company actor calls it `companySize`. Both use LinkedIn's A-I codes:
 * A = 1 employee
 * B = 2-10
 * C = 11-50
 * D = 51-200
 * E = 201-500
 * F = 501-1,000
 * G = 1,001-5,000
 * H = 5,001-10,000
 * I = 10,001+
 */
const HEADCOUNT_BANDS: readonly HeadcountBand[] = [
  { code: "A", min: 1, max: 1 },
  { code: "B", min: 2, max: 10 },
  { code: "C", min: 11, max: 50 },
  { code: "D", min: 51, max: 200 },
  { code: "E", min: 201, max: 500 },
  { code: "F", min: 501, max: 1000 },
  { code: "G", min: 1001, max: 5000 },
  { code: "H", min: 5001, max: 10000 },
  { code: "I", min: 10001, max: null },
] as const;

const COMPANY_SIZE_ALIASES: Record<string, readonly LinkedInCompanyHeadcountCode[]> = {
  "1": ["A"],
  "1-10": ["A", "B"],
  "1to10": ["A", "B"],
  "2-10": ["B"],
  "2to10": ["B"],
  "10-Jan": ["A", "B"],
  "11-50": ["C"],
  "11to50": ["C"],
  "50-200": ["D"],
  "50to200": ["D"],
  "51-200": ["D"],
  "51to200": ["D"],
  "201-500": ["E"],
  "201to500": ["E"],
  "501-1000": ["F"],
  "501to1000": ["F"],
  "1001-5000": ["G"],
  "1001to5000": ["G"],
  "5001-10000": ["H"],
  "5001to10000": ["H"],
  "10001+": ["I"],
  "10001plus": ["I"],
  "10000+": ["I"],
  "10000plus": ["I"],
  "small": ["A", "B", "C"],
  "smb": ["B", "C", "D"],
  "startup": ["A", "B", "C"],
  "midmarket": ["D", "E", "F"],
  "mid-market": ["D", "E", "F"],
  "enterprise": ["G", "H", "I"],
};

function normalizeCompanySize(value: string): string {
  return value
    .toLowerCase()
    .replace(/employees?|people|staff|headcount|company|companies/gi, "")
    .replace(/[,+]/g, (match) => (match === "+" ? "plus" : ""))
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+to\s+/g, "to")
    .replace(/\s+/g, "")
    .trim();
}

function parseRange(value: string): { min: number; max: number | null } | null {
  const normalized = normalizeCompanySize(value);
  const plusMatch = normalized.match(/^(\d+)plus$/);
  if (plusMatch) {
    return { min: Number(plusMatch[1]), max: null };
  }

  const rangeMatch = normalized.match(/^(\d+)(?:-|to)(\d+)$/);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }

  const exactMatch = normalized.match(/^\d+$/);
  if (exactMatch) {
    const exact = Number(normalized);
    return { min: exact, max: exact };
  }

  return null;
}

function overlapSize(
  requested: { min: number; max: number | null },
  band: HeadcountBand,
): number {
  const requestedMax = requested.max ?? Number.POSITIVE_INFINITY;
  const bandMax = band.max ?? Number.POSITIVE_INFINITY;
  const min = Math.max(requested.min, band.min);
  const max = Math.min(requestedMax, bandMax);
  return max >= min ? max - min + 1 : 0;
}

export function resolveCompanyHeadcountCodes(
  companySizes: readonly string[],
): LinkedInCompanyHeadcountCode[] {
  const codes: LinkedInCompanyHeadcountCode[] = [];
  const addCode = (code: LinkedInCompanyHeadcountCode) => {
    if (!codes.includes(code)) {
      codes.push(code);
    }
  };

  for (const size of companySizes) {
    const normalized = normalizeCompanySize(size);
    const aliasCodes = COMPANY_SIZE_ALIASES[normalized];
    if (aliasCodes) {
      aliasCodes.forEach(addCode);
      continue;
    }

    const parsed = parseRange(size);
    if (!parsed) {
      continue;
    }

    for (const band of HEADCOUNT_BANDS) {
      const overlap = overlapSize(parsed, band);
      if (overlap === 0) {
        continue;
      }

      const bandWidth =
        band.max === null ? Number.POSITIVE_INFINITY : band.max - band.min + 1;

      if (
        (bandWidth !== Number.POSITIVE_INFINITY && overlap / bandWidth >= 1) ||
        (parsed.max === null && band.max === null)
      ) {
        addCode(band.code);
      }
    }
  }

  return codes;
}
