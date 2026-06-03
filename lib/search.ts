import { getPrices } from "@/lib/store";
import { checkMany, type Availability } from "@/lib/rdap";
import { parseQuery, TLDS, tldRank } from "@/lib/tlds";
import { buildBuyLink } from "@/lib/affiliate";
import { rankOffers, totalCost } from "@/lib/scoring";
import { registrarMeta } from "@/lib/registrars/meta";
import type { PriceRecord, RegistrarId } from "@/lib/types";

export interface Offer {
  registrar: RegistrarId;
  registrarName: string;
  register_price: number;
  renew_price: number;
  transfer_price: number | null;
  five_year: number;
  currency: string;
  promo: boolean;
  monetized: boolean;
  buy_url: string; // internal /go redirect
}

export interface DomainResult {
  domain: string;
  tld: string;
  available: Availability;
  offers: Offer[];
  cheapestFiveYear: number | null;
}

export interface SearchResponse {
  query: string;
  label: string;
  results: DomainResult[];
}

function toOffer(r: PriceRecord, domain: string): Offer {
  const link = buildBuyLink(r.registrar, domain);
  return {
    registrar: r.registrar,
    registrarName: registrarMeta(r.registrar).name,
    register_price: r.register_price,
    renew_price: r.renew_price,
    transfer_price: r.transfer_price,
    five_year: totalCost(r, 5),
    currency: r.currency,
    promo: r.promo,
    monetized: link.monetized,
    buy_url: `/go/${r.registrar}?d=${encodeURIComponent(domain)}`,
  };
}

export async function search(
  raw: string,
  { availability = true }: { availability?: boolean } = {},
): Promise<SearchResponse> {
  const { label, tld } = parseQuery(raw);
  if (!label) return { query: raw, label: "", results: [] };

  const tlds = tld ? [tld] : [...TLDS];
  const domains = tlds.map((t) => `${label}.${t}`);

  const [prices, avail] = await Promise.all([
    getPrices(),
    availability
      ? checkMany(domains)
      : Promise.resolve({} as Record<string, Availability>),
  ]);

  const byTld = new Map<string, PriceRecord[]>();
  for (const p of prices) {
    const arr = byTld.get(p.tld);
    if (arr) arr.push(p);
    else byTld.set(p.tld, [p]);
  }

  const results: DomainResult[] = tlds.map((t) => {
    const domain = `${label}.${t}`;
    const ranked = rankOffers(byTld.get(t) ?? []);
    return {
      domain,
      tld: t,
      available: avail[domain] ?? "unknown",
      offers: ranked.map((r) => toOffer(r, domain)),
      cheapestFiveYear: ranked.length ? totalCost(ranked[0], 5) : null,
    };
  });

  // Available first, then unknown, then taken; within each, cheapest 5-year
  // total, then most popular TLD.
  const availRank = (a: Availability) => (a === true ? 0 : a === "unknown" ? 1 : 2);
  results.sort((a, b) => {
    const av = availRank(a.available) - availRank(b.available);
    if (av !== 0) return av;
    const ca = a.cheapestFiveYear ?? Infinity;
    const cb = b.cheapestFiveYear ?? Infinity;
    if (ca !== cb) return ca - cb;
    return tldRank(a.tld) - tldRank(b.tld);
  });

  return { query: raw, label, results };
}
