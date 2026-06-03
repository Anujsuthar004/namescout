import { getPrices } from "@/lib/store";
import { lookupMany } from "@/lib/rdap";
import { registrarMeta } from "@/lib/registrars/meta";
import { matchRegistrar, typicalRenewal } from "@/lib/registrars/reference";
import { normalizeTld } from "@/lib/tlds";
import type { PriceRecord, RegistrarId } from "@/lib/types";

/**
 * Portfolio renewal optimizer — the differentiated feature. A user pastes the
 * domains they own; for each we detect (via RDAP) the current registrar and
 * expiry date, find the cheapest renewal across tracked registrars, and compute
 * the 5-year savings from moving. This solves a real, under-served pain that the
 * generic price-table comparison sites don't: "where am I overpaying, and when
 * does each domain renew?"
 */

export const MAX_DOMAINS = 25;

export interface CheapestRenewal {
  registrar: RegistrarId;
  name: string;
  renewPrice: number;
  fiveYearRenew: number;
  buyUrl: string;
}

export interface OptimizeRow {
  domain: string;
  tld: string;
  status: "registered" | "available" | "unknown";
  currentRegistrar: string | null; // display name from RDAP
  currentRegistrarId: RegistrarId | null;
  expiry: string | null;
  daysToExpiry: number | null;
  currentRenewPrice: number | null;
  currentPriceEstimated: boolean;
  cheapest: CheapestRenewal | null;
  savingsFiveYear: number | null;
  alreadyCheapest: boolean;
  note: string | null;
}

export interface OptimizeResult {
  rows: OptimizeRow[];
  totalSavingsFiveYear: number;
  ownedCount: number;
  withSavingsCount: number;
}

/** Parse a pasted blob into a deduped, capped list of clean domains. */
export function parseDomains(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const d = cleanDomain(part);
    if (d) seen.add(d);
    if (seen.size >= MAX_DOMAINS) break;
  }
  return [...seen];
}

function cleanDomain(s: string): string | null {
  const d = s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return null;
  return d;
}

export async function optimize(domains: string[]): Promise<OptimizeResult> {
  if (!domains.length) {
    return { rows: [], totalSavingsFiveYear: 0, ownedCount: 0, withSavingsCount: 0 };
  }

  const [prices, infos] = await Promise.all([getPrices(), lookupMany(domains)]);

  // Cheapest *renewal* per TLD (existing owners only pay renewals, not year-1).
  const cheapestByTld = new Map<string, PriceRecord>();
  for (const p of prices) {
    const cur = cheapestByTld.get(p.tld);
    if (!cur || p.renew_price < cur.renew_price) cheapestByTld.set(p.tld, p);
  }

  const now = Date.now();

  const rows: OptimizeRow[] = domains.map((domain) => {
    const tld = normalizeTld(domain.slice(domain.lastIndexOf(".") + 1));
    const info = infos[domain] ?? {
      registered: "unknown" as const,
      registrarName: null,
      expiry: null,
    };
    const status =
      info.registered === true
        ? "registered"
        : info.registered === false
          ? "available"
          : "unknown";

    const rec = cheapestByTld.get(tld) ?? null;
    const cheapest: CheapestRenewal | null = rec
      ? {
          registrar: rec.registrar,
          name: registrarMeta(rec.registrar).name,
          renewPrice: rec.renew_price,
          fiveYearRenew: +(rec.renew_price * 5).toFixed(2),
          buyUrl: `/go/${rec.registrar}?d=${encodeURIComponent(domain)}`,
        }
      : null;

    const currentRegistrarId = matchRegistrar(info.registrarName);

    // Current renewal: exact feed price if we track that registrar, else a
    // typical estimate, else unknown.
    let currentRenewPrice: number | null = null;
    let currentPriceEstimated = false;
    if (currentRegistrarId) {
      const tracked = prices.find(
        (p) => p.registrar === currentRegistrarId && p.tld === tld,
      );
      if (tracked) {
        currentRenewPrice = tracked.renew_price;
      } else {
        const est = typicalRenewal(currentRegistrarId, tld);
        if (est != null) {
          currentRenewPrice = est;
          currentPriceEstimated = true;
        }
      }
    }

    const daysToExpiry = info.expiry
      ? Math.round((new Date(info.expiry).getTime() - now) / 86_400_000)
      : null;

    let savingsFiveYear: number | null = null;
    let alreadyCheapest = false;
    let note: string | null = null;

    if (status !== "registered") {
      note =
        status === "available"
          ? "Not registered — you don't own this."
          : "Couldn't reach RDAP for this TLD.";
    } else if (!cheapest) {
      note = `No tracked prices for .${tld}.`;
    } else if (currentRenewPrice == null) {
      note = info.registrarName
        ? `At ${info.registrarName} — renewal price not tracked.`
        : "Current registrar unknown.";
    } else if (
      currentRegistrarId === cheapest.registrar ||
      currentRenewPrice <= cheapest.renewPrice
    ) {
      alreadyCheapest = true;
      savingsFiveYear = 0;
      note = "Already on the cheapest tracked option.";
    } else {
      savingsFiveYear = +((currentRenewPrice - cheapest.renewPrice) * 5).toFixed(2);
    }

    return {
      domain,
      tld,
      status,
      currentRegistrar: info.registrarName,
      currentRegistrarId,
      expiry: info.expiry,
      daysToExpiry,
      currentRenewPrice,
      currentPriceEstimated,
      cheapest,
      savingsFiveYear,
      alreadyCheapest,
      note,
    };
  });

  // Biggest savings first, then soonest to expire.
  rows.sort((a, b) => {
    const sa = a.savingsFiveYear ?? -1;
    const sb = b.savingsFiveYear ?? -1;
    if (sb !== sa) return sb - sa;
    return (a.daysToExpiry ?? Infinity) - (b.daysToExpiry ?? Infinity);
  });

  return {
    rows,
    totalSavingsFiveYear: +rows
      .reduce((s, r) => s + (r.savingsFiveYear ?? 0), 0)
      .toFixed(2),
    ownedCount: rows.filter((r) => r.status === "registered").length,
    withSavingsCount: rows.filter((r) => (r.savingsFiveYear ?? 0) > 0).length,
  };
}
