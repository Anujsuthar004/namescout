import type { PriceRecord } from "@/lib/types";
import { registrarMeta } from "@/lib/registrars/meta";
import { tldRank } from "@/lib/tlds";

/**
 * Total cost of ownership over N years — register year 1, then renew.
 * This is NameScout's headline number: most registrars bait with a cheap
 * year 1 and recover it on renewals, so the 5-year total tells the real story.
 */
export const totalCost = (r: PriceRecord, years = 5): number =>
  r.register_price + r.renew_price * (years - 1);

/**
 * Rank score for an offer — lower is better. Driven mostly by 5-year cost,
 * nudged by registrar trust and a tiny promo bonus so genuine sales surface.
 */
export function offerScore(r: PriceRecord): number {
  const cost = totalCost(r, 5);
  const trustPenalty = (1 - registrarMeta(r.registrar).trust) * 8; // up to +$8
  const promoBonus = r.promo ? -1 : 0;
  return cost + trustPenalty + promoBonus;
}

/** Sort offers for one domain, cheapest/best first. */
export const rankOffers = (offers: PriceRecord[]): PriceRecord[] =>
  [...offers].sort((a, b) => offerScore(a) - offerScore(b));

/**
 * Sort whole domain results: available first, then by the best offer's
 * 5-year cost, then by TLD popularity.
 */
export function rankDomains<T extends { available: boolean | "unknown"; best?: PriceRecord; tld: string }>(
  rows: T[],
): T[] {
  const rankAvail = (a: boolean | "unknown") => (a === true ? 0 : a === "unknown" ? 1 : 2);
  return [...rows].sort((a, b) => {
    const av = rankAvail(a.available) - rankAvail(b.available);
    if (av !== 0) return av;
    const ca = a.best ? totalCost(a.best, 5) : Infinity;
    const cb = b.best ? totalCost(b.best, 5) : Infinity;
    if (ca !== cb) return ca - cb;
    return tldRank(a.tld) - tldRank(b.tld);
  });
}
