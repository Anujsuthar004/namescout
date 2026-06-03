import type { RegistrarId } from "@/lib/types";
import { normalizeTld } from "@/lib/tlds";

/**
 * The optimizer detects a domain's *current* registrar via RDAP, but we only
 * have live price feeds for a few registrars. The biggest savings are usually
 * against the expensive incumbents (GoDaddy, Namecheap), so we keep a small
 * table of *typical* renewal prices for them to estimate what a user is paying.
 *
 * These are approximate USD/yr and clearly labelled as estimates in the UI —
 * never presented as exact. They exist to surface "you're likely overpaying",
 * which the user can then verify against their actual invoice.
 */
const TYPICAL_RENEWAL: Partial<Record<RegistrarId, Record<string, number>>> = {
  godaddy: {
    com: 21.99,
    net: 24.99,
    org: 22.99,
    io: 64.99,
    co: 39.99,
    ai: 99.99,
    app: 22.99,
    dev: 19.99,
    me: 21.99,
    xyz: 14.99,
  },
  namecheap: {
    com: 14.98,
    net: 15.98,
    org: 15.98,
    io: 39.88,
    co: 27.98,
    ai: 87.98,
    app: 19.98,
    dev: 17.98,
    me: 21.98,
    xyz: 13.98,
  },
};

export interface CurrentEstimate {
  renewPrice: number;
  estimated: boolean; // true = from the typical table, false = exact feed price
}

/** A typical (estimated) renewal price for an untracked registrar, if known. */
export function typicalRenewal(
  registrar: RegistrarId,
  tld: string,
): number | null {
  return TYPICAL_RENEWAL[registrar]?.[normalizeTld(tld)] ?? null;
}

/**
 * Best-effort map an RDAP registrar name to one of our known RegistrarIds.
 * Returns null for registrars we neither track nor estimate.
 */
export function matchRegistrar(name: string | null): RegistrarId | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("porkbun")) return "porkbun";
  if (n.includes("cloudflare")) return "cloudflare";
  if (n.includes("dynadot")) return "dynadot";
  if (n.includes("namecheap")) return "namecheap";
  if (n.includes("godaddy") || n.includes("go daddy")) return "godaddy";
  return null;
}
