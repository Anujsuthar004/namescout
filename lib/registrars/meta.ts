import type { RegistrarId, RegistrarMeta } from "@/lib/types";

/**
 * Static registry of the registrars NameScout knows about, with their
 * capabilities. `hasFeed`/`hasAffiliate` reflect the mid-2026 reality
 * verified during planning — see lib/types.ts for the summary.
 */
export const REGISTRARS: Record<RegistrarId, RegistrarMeta> = {
  porkbun: {
    id: "porkbun",
    name: "Porkbun",
    hasFeed: true,
    hasAffiliate: false,
    trust: 0.9,
    siteUrl: "https://porkbun.com",
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare",
    hasFeed: true,
    hasAffiliate: false,
    trust: 0.95,
    siteUrl: "https://www.cloudflare.com/products/registrar/",
  },
  dynadot: {
    id: "dynadot",
    name: "Dynadot",
    hasFeed: true,
    hasAffiliate: true,
    trust: 0.85,
    siteUrl: "https://www.dynadot.com",
  },
  namecheap: {
    id: "namecheap",
    name: "Namecheap",
    hasFeed: true, // gated: requires $50 balance or 20 domains
    hasAffiliate: true,
    trust: 0.85,
    siteUrl: "https://www.namecheap.com",
  },
  godaddy: {
    id: "godaddy",
    name: "GoDaddy",
    hasFeed: true, // gated: Availability API needs 50+ domains
    hasAffiliate: true,
    trust: 0.8,
    siteUrl: "https://www.godaddy.com",
  },
};

export const registrarMeta = (id: RegistrarId): RegistrarMeta => REGISTRARS[id];
