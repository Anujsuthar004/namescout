import type { PriceFeedAdapter, PriceRecord } from "@/lib/types";
import { normalizeTld } from "@/lib/tlds";

/**
 * Porkbun's pricing/get endpoint is public — no API key required — and returns
 * registration/renewal/transfer for *every* TLD in a single request. This is
 * why Porkbun is the backbone of the price feed.
 *
 * Response shape:
 *   { status: "SUCCESS", pricing: { com: { registration, renewal, transfer }, ... } }
 */
const ENDPOINT = "https://api.porkbun.com/api/json/v3/pricing/get";

interface PorkbunPricing {
  status: string;
  pricing?: Record<
    string,
    { registration?: string; renewal?: string; transfer?: string }
  >;
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const porkbunAdapter: PriceFeedAdapter = {
  id: "porkbun",

  isConfigured: () => true, // public endpoint, always available

  async fetchPrices(tlds?: string[]): Promise<PriceRecord[]> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      // Porkbun's price list is stable; let Next cache it briefly server-side.
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      throw new Error(`Porkbun pricing/get failed: ${res.status}`);
    }
    const data = (await res.json()) as PorkbunPricing;
    if (data.status !== "SUCCESS" || !data.pricing) {
      throw new Error(`Porkbun pricing/get returned status ${data.status}`);
    }

    const wanted = tlds ? new Set(tlds.map(normalizeTld)) : null;
    const fetched_at = new Date().toISOString();
    const out: PriceRecord[] = [];

    for (const [rawTld, p] of Object.entries(data.pricing)) {
      const tld = normalizeTld(rawTld);
      if (wanted && !wanted.has(tld)) continue;

      const register = num(p.registration);
      const renew = num(p.renewal);
      if (register == null || renew == null) continue;

      out.push({
        tld,
        registrar: "porkbun",
        register_price: register,
        renew_price: renew,
        transfer_price: num(p.transfer),
        currency: "USD",
        promo: register < renew,
        fetched_at,
      });
    }
    return out;
  },
};
