/**
 * Price sync job: fetch every active registrar feed, normalize, persist.
 * Runs locally (`npm run sync`) and on GitHub Actions on a schedule.
 *
 * Porkbun + Cloudflare run with zero credentials, so this always produces a
 * usable snapshot. Dynadot/Supabase activate when their env vars are present.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { activeFeeds } from "../lib/registrars/index";
import { savePrices, usingSupabase } from "../lib/store";
import { TLDS } from "../lib/tlds";
import type { PriceRecord } from "../lib/types";

// Minimal .env.local loader (no dependency) so local runs pick up keys.
async function loadEnv() {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* no .env.local — fine */
  }
}

async function main() {
  await loadEnv();

  const feeds = activeFeeds();
  console.log(`Syncing ${feeds.length} feed(s): ${feeds.map((f) => f.id).join(", ")}`);

  const all: PriceRecord[] = [];
  for (const feed of feeds) {
    try {
      const records = await feed.fetchPrices([...TLDS]);
      console.log(`  ${feed.id}: ${records.length} TLD prices`);
      all.push(...records);
    } catch (err) {
      console.error(`  ${feed.id}: FAILED — ${(err as Error).message}`);
    }
  }

  if (all.length === 0) {
    console.error("No prices fetched; aborting without overwriting store.");
    process.exit(1);
  }

  await savePrices(all);
  console.log(
    `Saved ${all.length} records to ${usingSupabase() ? "Supabase" : "data/prices.json"}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
