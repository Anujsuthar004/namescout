import { normalizeTld } from "@/lib/tlds";

/**
 * Domain availability via RDAP — the ground truth. RDAP servers are per-TLD,
 * so we resolve the right server through IANA's bootstrap registry
 * (https://data.iana.org/rdap/dns.json), then query {server}/domain/{name}.
 *
 *   404  -> not registered  -> AVAILABLE
 *   200  -> registered      -> TAKEN
 *   else / no server / error -> UNKNOWN (UI shows prices anyway)
 */

export type Availability = true | false | "unknown";

const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const TIMEOUT_MS = 4000;

interface BootstrapFile {
  services: [string[], string[]][]; // [ [tlds...], [rdapBaseUrls...] ]
}

let bootstrapCache: { map: Map<string, string>; at: number } | null = null;
const BOOTSTRAP_TTL = 24 * 60 * 60 * 1000; // 24h

async function loadBootstrap(): Promise<Map<string, string>> {
  if (bootstrapCache && Date.now() - bootstrapCache.at < BOOTSTRAP_TTL) {
    return bootstrapCache.map;
  }
  const map = new Map<string, string>();
  try {
    const res = await fetch(BOOTSTRAP_URL, { next: { revalidate: 86400 } });
    if (res.ok) {
      const data = (await res.json()) as BootstrapFile;
      for (const [tlds, urls] of data.services) {
        const base = urls.find((u) => u.startsWith("https")) ?? urls[0];
        if (!base) continue;
        for (const tld of tlds) map.set(normalizeTld(tld), base.replace(/\/$/, ""));
      }
    }
  } catch {
    // fall through with whatever we have (possibly empty)
  }
  bootstrapCache = { map, at: Date.now() };
  return map;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/rdap+json" },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function checkAvailability(domain: string): Promise<Availability> {
  const tld = normalizeTld(domain.slice(domain.lastIndexOf(".") + 1));
  const map = await loadBootstrap();
  const base = map.get(tld);
  if (!base) return "unknown"; // TLD not in RDAP bootstrap (e.g. some ccTLDs)

  try {
    const res = await fetchWithTimeout(`${base}/domain/${domain}`);
    if (res.status === 404) return true; // available
    if (res.status === 200) return false; // taken
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Check many domains with bounded concurrency. */
export async function checkMany(
  domains: string[],
  concurrency = 8,
): Promise<Record<string, Availability>> {
  const result: Record<string, Availability> = {};
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, domains.length) }, async () => {
    while (i < domains.length) {
      const d = domains[i++];
      result[d] = await checkAvailability(d);
    }
  });
  await Promise.all(workers);
  return result;
}
