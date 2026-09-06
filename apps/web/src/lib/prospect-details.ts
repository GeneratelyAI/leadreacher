export const PROSPECT_CATEGORIES = [
  { key: "decisionMakers", label: "Decision makers" },
  { key: "companyTypes", label: "Company types" },
  { key: "industries", label: "Industries" },
  { key: "locations", label: "Location" },
] as const;

export type ProspectCategory = typeof PROSPECT_CATEGORIES[number]["key"];
export type ProspectDetails = Record<ProspectCategory, string[]>;

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
const countryCodes = "AF AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const locations = new Set(countryCodes.map((code) => normalize(regionNames.of(code) ?? code)));
const aliases: Record<string, string> = {
  uk: "United Kingdom", usa: "United States", us: "United States", uae: "United Arab Emirates",
  "u.s.": "United States", "u.s.a.": "United States", "u.k.": "United Kingdom",
  "south korea": "South Korea", "north korea": "North Korea", "czech republic": "Czech Republic",
  "latin america": "Latin America", europe: "Europe", asia: "Asia", africa: "Africa",
  "north america": "North America", "south america": "South America", oceania: "Oceania",
  "middle east": "Middle East", apac: "APAC", emea: "EMEA", latam: "Latin America",
  worldwide: "Worldwide", global: "Global", "united states": "United States",
};
const industries = new Set("technology|financial services|healthcare|health care|retail|consulting|real estate|hospitality|education|finance|banking|insurance|energy|agriculture|construction|manufacturing|telecommunications|transportation|logistics|entertainment|media|automotive|pharmaceuticals|biotechnology|software|cybersecurity|e-commerce|ecommerce|food and beverage|travel|tourism".split("|"));

export function splitProspectDetails(input: string): string[] {
  const seen = new Set<string>();
  return input.split(/[,;\r\n]+/).map((value) => value.trim().replace(/\s+/g, " ")).filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function classifyProspectDetail(raw: string): { value: string; category: ProspectCategory | null } {
  const value = raw.trim().replace(/\s+/g, " ");
  const geographic = value.replace(/^(?:based\s+in|located\s+in|in|across|throughout)\s+/i, "");
  const key = normalize(geographic);
  // Short uppercase ISO codes are geographic; lowercase words such as "in" are not.
  const iso = /^[A-Z]{2}$/.test(geographic) && countryCodes.includes(geographic);
  if (locations.has(key) || aliases[key] || iso) {
    return { value: aliases[key] ?? (iso ? regionNames.of(geographic)! : geographic), category: "locations" };
  }
  const candidates: ProspectCategory[] = [];
  if (/\b(founder|co-founder|ceo|cfo|cto|coo|cmo|cio|chief|vp|vice president|director|head of|manager|president|owner|partner)\b/i.test(value)) candidates.push("decisionMakers");
  if (/\b(saas|startups?|enterprises?|agenc(?:y|ies)|retailers?|manufacturers?|marketplaces?|nonprofits?|non-profits?|b2b|b2c|small businesses|smbs?)\b/i.test(value)) candidates.push("companyTypes");
  if (industries.has(normalize(value))) candidates.push("industries");
  return { value, category: candidates.length === 1 ? candidates[0]! : null };
}

export function appendProspectDetail(profile: ProspectDetails, category: ProspectCategory, value: string): ProspectDetails {
  if (Object.values(profile).some((values) => values.some((entry) => normalize(entry) === normalize(value)))) return profile;
  return { ...profile, [category]: [...profile[category], value.trim()] };
}
