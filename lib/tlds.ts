// The curated TLD set NameScout covers. Ordered by rough popularity/trust,
// which doubles as a tie-breaker weight in ranking (earlier = more trusted).

export const TLDS = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "ai",
  "app",
  "dev",
  "me",
  "xyz",
  "gg",
  "so",
  "sh",
  "tech",
  "studio",
  "design",
  "store",
  "shop",
  "site",
  "online",
] as const;

export type Tld = (typeof TLDS)[number];

const TLD_SET = new Set<string>(TLDS);

export const isKnownTld = (tld: string): boolean => TLD_SET.has(normalizeTld(tld));

/** Strip a leading dot and lowercase. "  .IO " -> "io". */
export const normalizeTld = (tld: string): string =>
  tld.trim().toLowerCase().replace(/^\./, "");

/** TLD popularity rank, 0 (most popular) .. 1 (least). Used in scoring. */
export const tldRank = (tld: string): number => {
  const i = TLDS.indexOf(normalizeTld(tld) as Tld);
  return i === -1 ? 1 : i / (TLDS.length - 1);
};

/**
 * Parse a raw user query into a bare label + an optional explicit TLD.
 * "MyCoolApp.io" -> { label: "mycoolapp", tld: "io" }
 * "my cool app"  -> { label: "mycoolapp", tld: null }
 */
export function parseQuery(raw: string): { label: string; tld: string | null } {
  const cleaned = raw.trim().toLowerCase();
  const dot = cleaned.lastIndexOf(".");
  if (dot > 0) {
    const maybeTld = normalizeTld(cleaned.slice(dot + 1));
    if (isKnownTld(maybeTld)) {
      return { label: sanitizeLabel(cleaned.slice(0, dot)), tld: maybeTld };
    }
  }
  return { label: sanitizeLabel(cleaned), tld: null };
}

/** Keep only chars valid in a domain label. */
export function sanitizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}
