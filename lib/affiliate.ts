import type { RegistrarId } from "@/lib/types";
import { registrarMeta } from "@/lib/registrars/meta";

/**
 * Affiliate link building is independent of price feeds: we can send a
 * registrar traffic without having API access to its prices, and vice versa.
 *
 * Affiliate IDs come from env so placeholders ship safely and real IDs drop in
 * after the programs approve the live site (Impact/Dynadot generally require a
 * live site before approval — chicken-and-egg, so we deploy first).
 */

export interface BuyLink {
  /** Final outbound URL (affiliate-wrapped where we have a program). */
  url: string;
  /** True when the click can earn commission. */
  monetized: boolean;
}

function direct(registrar: RegistrarId, domain: string): string {
  switch (registrar) {
    case "porkbun":
      return `https://porkbun.com/checkout/search?q=${encodeURIComponent(domain)}`;
    case "cloudflare":
      return "https://dash.cloudflare.com/?to=/:account/registrar/register";
    case "dynadot":
      return `https://www.dynadot.com/domain/search?domain=${encodeURIComponent(domain)}`;
    case "namecheap":
      return `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`;
    case "godaddy":
      return `https://www.godaddy.com/domainsearch/find?domainToCheck=${encodeURIComponent(domain)}`;
  }
}

export function buildBuyLink(registrar: RegistrarId, domain: string): BuyLink {
  const meta = registrarMeta(registrar);
  const target = direct(registrar, domain);

  if (!meta.hasAffiliate) {
    return { url: target, monetized: false };
  }

  switch (registrar) {
    case "namecheap": {
      // Namecheap runs through Impact; affiliate id in env.
      const id = process.env.NEXT_PUBLIC_NAMECHEAP_AFFILIATE_ID;
      if (!id) return { url: target, monetized: false };
      return {
        url: `https://namecheap.pxf.io/c/${id}/386170/5618?u=${encodeURIComponent(target)}`,
        monetized: true,
      };
    }
    case "dynadot": {
      const id = process.env.NEXT_PUBLIC_DYNADOT_AFFILIATE_ID;
      if (!id) return { url: target, monetized: false };
      const sep = target.includes("?") ? "&" : "?";
      return { url: `${target}${sep}aff=${encodeURIComponent(id)}`, monetized: true };
    }
    case "godaddy": {
      const id = process.env.NEXT_PUBLIC_GODADDY_CJ_ID;
      if (!id) return { url: target, monetized: false };
      return {
        url: `https://www.anrdoezrs.net/click-${id}?url=${encodeURIComponent(target)}`,
        monetized: true,
      };
    }
    default:
      return { url: target, monetized: false };
  }
}
