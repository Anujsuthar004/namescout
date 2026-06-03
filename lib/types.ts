// Unified domain pricing schema — every registrar adapter normalizes into this.

export type Currency = "USD";

export type RegistrarId =
  | "porkbun"
  | "cloudflare"
  | "dynadot"
  | "namecheap"
  | "godaddy";

/** One registrar's offer for one TLD. The canonical row stored in the DB. */
export interface PriceRecord {
  tld: string; // normalized, no leading dot, e.g. "com"
  registrar: RegistrarId;
  register_price: number; // year 1
  renew_price: number; // year 2+
  transfer_price: number | null;
  currency: Currency;
  promo: boolean; // register price is below the typical/renewal price
  fetched_at: string; // ISO timestamp
}

/**
 * The key architectural split: a registrar can provide a price *feed*,
 * an *affiliate* link, both, or neither. They are independent capabilities.
 *
 *   Porkbun    — feed,  no affiliate  (public endpoint, discontinued affiliate)
 *   Cloudflare — feed,  no affiliate  (at-cost baseline, no referral program)
 *   Dynadot    — feed,  affiliate     (free reseller API + Ambassador 30%)
 *   Namecheap  — feed*, affiliate     (*API gated behind $50 balance)
 *   GoDaddy    — feed*, affiliate     (*Availability API needs 50+ domains)
 */
export interface RegistrarMeta {
  id: RegistrarId;
  name: string;
  hasFeed: boolean;
  hasAffiliate: boolean;
  /** Reputation/trust weight for ranking, 0..1. */
  trust: number;
  /** Base URL used to build a direct (non-affiliate) buy link. */
  siteUrl: string;
}

/** A price-data source. Read-only; produces normalized PriceRecords. */
export interface PriceFeedAdapter {
  id: RegistrarId;
  /** True when required credentials/env are present and the adapter can run. */
  isConfigured(): boolean;
  /** Fetch prices, optionally filtered to a set of normalized TLDs. */
  fetchPrices(tlds?: string[]): Promise<PriceRecord[]>;
}
