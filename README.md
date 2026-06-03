# NameScout

**Skyscanner for domains.** Compare domain registration *and* renewal prices
across registrars, and see the **true 5-year cost** — so a cheap year-1 promo
can't fool you. Affiliate links monetize the clicks; you never handle payments
or DNS.

## Why it exists

Most domain buyers compare the year-1 price. Registrars know this and bait with
a cheap first year, then recover it on renewals. NameScout surfaces the renewal
price and the **5-year total cost of ownership** as first-class columns, and
ranks by true cost — not the headline.

## Architecture

```
Registrar feeds ──► Normalizer ──► Store ──► Search/Compare UI
 (Porkbun,                         (Supabase     │
  Cloudflare,                       or local      ├─ /            search any name across all TLDs
  Dynadot)                          JSON)         ├─ /compare/io  per-TLD SEO landing page
                                                  └─ /go/:reg     affiliate-aware redirect
        ▲                                              ▲
  hourly sync job                              RDAP availability
  (GitHub Actions)                             (IANA bootstrap)
```

### The key design split: feeds vs. affiliates are independent

A registrar can provide a **price feed**, an **affiliate** program, both, or
neither (`lib/types.ts`). We show the genuinely cheapest option even when we
earn nothing on it (that's what makes a comparison trustworthy), and we can
monetize a registrar without having API access to its prices.

| Registrar  | Price feed                         | Affiliate            |
| ---------- | ---------------------------------- | -------------------- |
| Porkbun    | ✅ public endpoint, no key         | ❌ discontinued       |
| Cloudflare | ✅ at-cost baseline (floor)        | ❌ none               |
| Dynadot    | ✅ free reseller API key           | ✅ Ambassador 30%     |
| Namecheap  | ⚠️ API gated ($50 / 20 domains)    | ✅ Impact 25–38%      |
| GoDaddy    | ⚠️ API gated (50+ domains)         | ✅ CJ                 |

## Quick start

```bash
npm install
npm run sync     # fetch prices -> data/prices.json (Porkbun + Cloudflare, no keys needed)
npm run dev      # http://localhost:3000
```

Everything runs with **zero credentials**: Porkbun's public endpoint + the
Cloudflare at-cost baseline populate the table, and without Supabase the app
reads/writes a local `data/prices.json` snapshot.

## Configuration

Copy `.env.example` → `.env.local` and fill in what you have (all optional):

- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — use Supabase instead of the
  local JSON snapshot. Schema in `supabase/schema.sql`.
- `DYNADOT_API_KEY` — free reseller account; unlocks the Dynadot price column.
- `CF_API_TOKEN` — switch Cloudflare from at-cost baseline to the live
  Registrar API (TODO in `lib/registrars/cloudflare.ts`).
- `NEXT_PUBLIC_*_AFFILIATE_ID` — drop in once each affiliate program approves
  your live site. Until then "Buy" links go direct (unmonetized, marked `↗`).

## Sync job

`npm run sync` fetches every configured feed, normalizes to the unified schema,
and upserts to the store. Automated hourly via `.github/workflows/sync.yml`
(set the same env vars as GitHub Actions secrets).

## Going public — checklist

- [ ] Deploy to Vercel, point a domain at it.
- [ ] Provision Supabase, run `supabase/schema.sql`, set env + Actions secrets.
- [ ] Apply to affiliate programs (need a live site first): Dynadot Ambassador,
      Namecheap via Impact, GoDaddy via CJ. Add the IDs to env.
- [ ] Review each registrar's API ToS for competitive-comparison clauses before
      displaying their prices.
- [ ] Keep the FTC affiliate disclosure visible (already in the footer).

## Project layout

```
app/
  page.tsx                 search UI (client)
  optimizer/page.tsx       renewal optimizer UI (paste-your-domains)
  api/search/route.ts      search endpoint (prices + availability + offers)
  api/optimize/route.ts    renewal optimizer endpoint
  go/[registrar]/route.ts  affiliate-aware outbound redirect
  compare/[tld]/page.tsx   pre-rendered per-TLD SEO landing pages
lib/
  types.ts                 unified schema + adapter contracts
  registrars/              porkbun · cloudflare · dynadot adapters + meta
                           reference.ts: typical renewals + RDAP name matching
  store.ts                 Supabase / local-JSON pluggable store
  rdap.ts                  availability + registrar/expiry via IANA bootstrap
  search.ts                ties prices + availability + ranking together
  optimizer.ts             detect current registrar/expiry → cheapest renewal → savings
  scoring.ts               5-year TCO + ranking
  affiliate.ts             affiliate link builder (independent of feeds)
  tlds.ts                  covered TLD catalog + query parsing
scripts/sync.ts            the price sync job
```

## Features

- **Compare** (`/`) — search a name across TLDs, ranked by true 5-year cost.
- **Renewal optimizer** (`/optimizer`) — paste domains you own; RDAP detects the
  current registrar + expiry date for each, and we show where to renew/transfer
  to save, with estimated 5-year savings. The differentiated, under-served bit.
- **Per-TLD SEO pages** (`/compare/[tld]`) — pre-rendered price tables.
