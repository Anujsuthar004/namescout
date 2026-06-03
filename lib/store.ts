import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { PriceRecord } from "@/lib/types";

/**
 * Pluggable price store. Uses Supabase when SUPABASE_URL + a service key are
 * present; otherwise falls back to a local JSON snapshot at data/prices.json.
 * The fallback lets the whole app run end-to-end with zero external accounts —
 * `npm run sync` writes it, the UI reads it.
 */

const LOCAL_PATH = path.join(process.cwd(), "data", "prices.json");
const TABLE = "prices";

function supabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const usingSupabase = (): boolean => supabase() !== null;

export async function savePrices(records: PriceRecord[]): Promise<void> {
  const db = supabase();
  if (db) {
    // Upsert on the (tld, registrar) natural key.
    const { error } = await db
      .from(TABLE)
      .upsert(records, { onConflict: "tld,registrar" });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, JSON.stringify(records, null, 2));
}

export async function getPrices(): Promise<PriceRecord[]> {
  const db = supabase();
  if (db) {
    const { data, error } = await db.from(TABLE).select("*");
    if (error) throw new Error(`Supabase select failed: ${error.message}`);
    return (data ?? []) as PriceRecord[];
  }
  try {
    const raw = await fs.readFile(LOCAL_PATH, "utf8");
    return JSON.parse(raw) as PriceRecord[];
  } catch {
    return []; // no snapshot yet — run `npm run sync`
  }
}

/** Prices for a single TLD, cheapest 5-year total first. */
export async function getPricesForTld(tld: string): Promise<PriceRecord[]> {
  const all = await getPrices();
  return all.filter((r) => r.tld === tld);
}
