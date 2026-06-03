import { normalizeTld } from "@/lib/tlds";

/**
 * RDAP lookups — the ground truth for domain status. RDAP servers are per-TLD,
 * so we resolve the right server through IANA's bootstrap registry
 * (https://data.iana.org/rdap/dns.json), then query {server}/domain/{name}.
 *
 *   404  -> not registered  -> AVAILABLE
 *   200  -> registered      -> TAKEN (and the body tells us registrar + expiry)
 *   else / no server / error -> UNKNOWN
 */

export type Availability = true | false | "unknown";

export interface RdapInfo {
  registered: boolean | "unknown";
  registrarName: string | null;
  expiry: string | null; // ISO date string
}

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

/** Raw RDAP query: returns the HTTP status and parsed body (if any). */
async function rdapQuery(
  domain: string,
): Promise<{ status: number; body: RdapDomain | null }> {
  const tld = normalizeTld(domain.slice(domain.lastIndexOf(".") + 1));
  const map = await loadBootstrap();
  const base = map.get(tld);
  if (!base) return { status: 0, body: null };
  try {
    const res = await fetchWithTimeout(`${base}/domain/${domain}`);
    let body: RdapDomain | null = null;
    if (res.status === 200) {
      body = (await res.json().catch(() => null)) as RdapDomain | null;
    }
    return { status: res.status, body };
  } catch {
    return { status: -1, body: null };
  }
}

export async function checkAvailability(domain: string): Promise<Availability> {
  const { status } = await rdapQuery(domain);
  if (status === 404) return true; // available
  if (status === 200) return false; // taken
  return "unknown";
}

/** Full lookup: status + current registrar + expiry date (for owned domains). */
export async function lookupDomain(domain: string): Promise<RdapInfo> {
  const { status, body } = await rdapQuery(domain);
  if (status === 404) {
    return { registered: false, registrarName: null, expiry: null };
  }
  if (status !== 200 || !body) {
    return { registered: "unknown", registrarName: null, expiry: null };
  }
  return {
    registered: true,
    registrarName: extractRegistrar(body),
    expiry: extractExpiry(body),
  };
}

/** Check many domains' availability with bounded concurrency. */
export async function checkMany(
  domains: string[],
  concurrency = 8,
): Promise<Record<string, Availability>> {
  return mapConcurrent(domains, concurrency, checkAvailability);
}

/** Full lookups for many domains with bounded concurrency. */
export async function lookupMany(
  domains: string[],
  concurrency = 6,
): Promise<Record<string, RdapInfo>> {
  return mapConcurrent(domains, concurrency, lookupDomain);
}

async function mapConcurrent<T>(
  items: string[],
  concurrency: number,
  fn: (item: string) => Promise<T>,
): Promise<Record<string, T>> {
  const result: Record<string, T> = {};
  let i = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (i < items.length) {
        const item = items[i++];
        result[item] = await fn(item);
      }
    },
  );
  await Promise.all(workers);
  return result;
}

// --- RDAP body parsing -----------------------------------------------------

interface RdapVcardEntity {
  roles?: string[];
  handle?: string;
  vcardArray?: [string, Array<[string, object, string, string]>];
  publicIds?: { type?: string; identifier?: string }[];
  entities?: RdapVcardEntity[];
}
interface RdapDomain {
  events?: { eventAction?: string; eventDate?: string }[];
  entities?: RdapVcardEntity[];
}

function extractExpiry(body: RdapDomain): string | null {
  const ev = body.events?.find((e) => e.eventAction === "expiration");
  return ev?.eventDate ?? null;
}

function extractRegistrar(body: RdapDomain): string | null {
  const reg = findEntityWithRole(body.entities, "registrar");
  if (!reg) return null;
  // Preferred: the formatted name ("fn") from the vCard.
  const vcard = reg.vcardArray?.[1];
  const fn = vcard?.find((item) => item[0] === "fn");
  if (fn && typeof fn[3] === "string" && fn[3].trim()) return fn[3].trim();
  return reg.handle ?? null;
}

function findEntityWithRole(
  entities: RdapVcardEntity[] | undefined,
  role: string,
): RdapVcardEntity | null {
  if (!entities) return null;
  for (const e of entities) {
    if (e.roles?.includes(role)) return e;
    const nested = findEntityWithRole(e.entities, role);
    if (nested) return nested;
  }
  return null;
}
