import type { PriceFeedAdapter, PriceRecord } from "@/lib/types";
import { normalizeTld } from "@/lib/tlds";

/**
 * Cloudflare sells domains at cost (registry + ICANN fee, no markup), so its
 * price is the credibility *floor* for the whole table — "nobody can beat this,
 * here's how much your registrar marks up."
 *
 * Two modes:
 *  - If CF_API_TOKEN is set, production should call the Cloudflare Registrar API
 *    (beta, 2026) for live availability+pricing. That call is left as a clearly
 *    marked TODO so we never ship a half-working live integration.
 *  - Otherwise we serve a maintained at-cost baseline. At-cost prices track the
 *    registry wholesale price and move rarely, so this is an honest reference
 *    floor (the UI labels it "at-cost"). register === renew by definition —
 *    Cloudflare never does year-1 bait pricing.
 *
 * These baselines are approximate USD/yr and should be refreshed periodically.
 */
const AT_COST: Record<string, number> = {
  com: 10.44,
  net: 12.18,
  org: 10.1,
  io: 38.0,
  co: 24.0,
  ai: 65.0,
  app: 12.18,
  dev: 12.18,
  me: 18.0,
  xyz: 10.0,
  gg: 60.0,
  so: 55.0,
  sh: 36.0,
  tech: 45.0,
  studio: 28.0,
  design: 38.0,
  store: 55.0,
  shop: 32.0,
  site: 30.0,
  online: 35.0,
};

export const cloudflareAdapter: PriceFeedAdapter = {
  id: "cloudflare",

  isConfigured: () => true, // at-cost baseline is always available

  async fetchPrices(tlds?: string[]): Promise<PriceRecord[]> {
    if (process.env.CF_API_TOKEN) {
      // TODO(production): call the Cloudflare Registrar API for live pricing.
      // Until implemented, fall through to the at-cost baseline below.
    }

    const wanted = tlds ? new Set(tlds.map(normalizeTld)) : null;
    const fetched_at = new Date().toISOString();

    return Object.entries(AT_COST)
      .filter(([tld]) => !wanted || wanted.has(tld))
      .map(([tld, price]) => ({
        tld,
        registrar: "cloudflare" as const,
        register_price: price,
        renew_price: price,
        transfer_price: price,
        currency: "USD" as const,
        promo: false,
        fetched_at,
      }));
  },
};
