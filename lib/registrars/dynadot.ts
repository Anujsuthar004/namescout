import type { PriceFeedAdapter, PriceRecord } from "@/lib/types";
import { normalizeTld } from "@/lib/tlds";

/**
 * Dynadot is the anchor partner: a *free* reseller API account (no deposit,
 * no pre-purchase) AND an affiliate/Ambassador program (30%). It's the only
 * registrar where we both show the price and earn on the click.
 *
 * Requires DYNADOT_API_KEY (from a free reseller account). Without it the
 * adapter reports itself unconfigured and is skipped by the sync job.
 *
 * get_tld_price returns a price list per TLD/currency. Dynadot's API3 JSON
 * shape varies by command; we defensively normalize whatever register/renew/
 * transfer fields are present.
 */
const ENDPOINT = "https://api.dynadot.com/api3.json";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Pull the first usable numeric price from a set of candidate fields. */
const pick = (obj: Record<string, unknown>, keys: string[]): number | null => {
  for (const k of keys) {
    const n = num(obj[k]);
    if (n != null) return n;
  }
  return null;
};

export const dynadotAdapter: PriceFeedAdapter = {
  id: "dynadot",

  isConfigured: () => Boolean(process.env.DYNADOT_API_KEY),

  async fetchPrices(tlds?: string[]): Promise<PriceRecord[]> {
    const key = process.env.DYNADOT_API_KEY;
    if (!key) return [];

    const url = `${ENDPOINT}?key=${encodeURIComponent(key)}&command=get_tld_price&currency=USD`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Dynadot get_tld_price failed: ${res.status}`);

    const data = (await res.json()) as Record<string, unknown>;
    // The TLD price array can be nested under a few possible keys depending on
    // the API version; find the first array of price rows.
    const rows = findPriceRows(data);

    const wanted = tlds ? new Set(tlds.map(normalizeTld)) : null;
    const fetched_at = new Date().toISOString();
    const out: PriceRecord[] = [];

    for (const row of rows) {
      const rawTld = String(row.tld ?? row.domain ?? "").replace(/^\./, "");
      if (!rawTld) continue;
      const tld = normalizeTld(rawTld);
      if (wanted && !wanted.has(tld)) continue;

      const register = pick(row, ["register", "registration", "yearly", "price"]);
      const renew = pick(row, ["renew", "renewal"]) ?? register;
      if (register == null || renew == null) continue;

      out.push({
        tld,
        registrar: "dynadot",
        register_price: register,
        renew_price: renew,
        transfer_price: pick(row, ["transfer"]),
        currency: "USD",
        promo: register < renew,
        fetched_at,
      });
    }
    return out;
  },
};

function findPriceRows(data: Record<string, unknown>): Record<string, unknown>[] {
  // Common shapes: { TldPriceResponse: { TldPrice: [...] } } or { tld_price: [...] }
  const stack: unknown[] = [data];
  while (stack.length) {
    const cur = stack.pop();
    if (Array.isArray(cur)) {
      if (cur.length && typeof cur[0] === "object" && cur[0] !== null) {
        return cur as Record<string, unknown>[];
      }
      continue;
    }
    if (cur && typeof cur === "object") {
      stack.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return [];
}
