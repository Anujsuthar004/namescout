# NameScout — Engineering & Product Case Study

> A domain price-comparison tool ("Skyscanner for domains"), built end-to-end
> in a day, then **honestly assessed against its market**. This document is the
> interesting part: it shows the architecture decisions and — more importantly —
> the product judgment about whether the thing was worth building.

**Live:** https://namescout-tau.vercel.app · **Repo:** https://github.com/Anujsuthar004/namescout

---

## 1. The idea and the honest market verdict

The pitch: aggregate domain prices across registrars so buyers compare in one
place and pick where to buy — like Skyscanner for flights. The differentiator:
show **renewal price and true 5-year cost**, not just the cheap-year-1 bait.

**Verdict after research: this is a red ocean, and the differentiator is taken.**
The exact product already exists and is mature:

| Incumbent | What it does |
| --- | --- |
| [TLD-List](https://tld-list.com/) | Registration + renewal prices across dozens of registrars |
| [Domcomp](https://domcomp.com/) | Real-time multi-registrar pricing |
| [DomainOffer](https://domainoffer.net/price-compare) | 149+ prices per TLD |
| [domaindetails](https://domaindetails.com/registrars/cheapest) | Branded *"True Cost Comparison"* — the same 5-year angle |

Even the "true cost" framing I built the brand around is a standard pitch. And
the actually-cheapest .com in 2026 (Spaceship, ~$2.90 reg / $9.98 renewal) isn't
something a clean-API approach can even surface.

**Why "Skyscanner for domains" is structurally weaker than for flights:**

1. **Small price spread.** A .com varies ~$2–5/yr across registrars vs hundreds
   of dollars for flights. The spread only gets meaningful on renewals and niche
   TLDs (.io, .ai) — which is why the 5-year-cost angle is the *only* honest hook.
2. **Not a pure commodity.** A flight seat is identical wherever bought; a domain
   bundles WHOIS privacy, transfer friction, DNS, hidden ICANN fees.
3. **Monetization fights the user.** The cheapest registrars (Porkbun, Cloudflare,
   Spaceship) have no affiliate program — you only earn by sending people to
   *not*-the-cheapest. (See §3.)
4. **Breadth is the moat — and it's gated.** Incumbents compile from public price
   pages to reach dozens of registrars. A clean-API approach caps out at ~3–4.

**Conclusion:** as a business, don't compete head-on. As an engineering portfolio
piece — external API integration, an adapter/normalization layer, RDAP, a
zero-infra deployment, and clear-eyed product judgment — it stands on its own.
NameScout is therefore deliberately scoped to the registrars with **flat,
predictable renewal pricing** (Porkbun, Cloudflare, Dynadot), which is a real,
defensible editorial stance rather than a worse copy of TLD-List.

---

## 2. Feasibility research (the part that shaped the architecture)

Verified the mid-2026 reality of each registrar's *price feed* vs *affiliate*
program — because they turned out to be independent and inversely correlated:

| Registrar | Price feed | Affiliate |
| --- | --- | --- |
| Porkbun | Public endpoint, no key | Discontinued |
| Cloudflare | At-cost baseline (the price floor) | None |
| **Dynadot** | Free reseller API | **Ambassador 30% — the only one with both** |
| Namecheap | Gated: $50 balance / 20 domains | Impact 25–38% |
| GoDaddy | Gated: 50+ domains | CJ |

**Key insight that became the core abstraction:** you don't need a registrar's
API to send it affiliate traffic, and you can show a registrar's price without
earning on it. Feeds and affiliates are *independent capabilities*.

---

## 3. Architecture

```
Registrar feeds ──► Normalizer ──► Store ──► Search / Compare UI
 (adapters)                       (pluggable)   │
        ▲                             ▲         ├─ /            search a name across TLDs
  hourly sync job              RDAP availability ├─ /compare/io  per-TLD SEO page (SSG)
  (GitHub Actions)             (IANA bootstrap)  └─ /go/:reg     affiliate-aware redirect
```

Decisions worth calling out:

- **Feed/affiliate split** (`lib/types.ts`): each registrar implements a
  `PriceFeedAdapter`, an affiliate link builder, both, or neither. New registrars
  are isolated, testable units.
- **Dropped Redis for the MVP.** The original plan had a two-tier Redis+Postgres
  cache. But Porkbun returns *every* TLD in one unauthenticated call, so the right
  move was: sync the whole list hourly → store → serve. Less infra, same result.
- **Pluggable store** (`lib/store.ts`): Supabase when configured, else a local
  JSON snapshot — so the whole app runs with zero external accounts.
- **"Git as database" deploy.** No DB provisioned: the price snapshot is committed,
  bundled into the serverless function via `outputFileTracingIncludes`, and a
  GitHub Action refreshes + commits it hourly, auto-redeploying via Vercel. Total
  infra cost: $0.
- **RDAP for availability** via the IANA bootstrap registry (the right server per
  TLD), with timeouts and graceful "unknown" so the price table never blocks on it.

---

## 4. What I'd do differently / next

- **If pursuing it seriously:** abandon the price-table race and pivot to a
  *portfolio renewal optimizer* ("paste your domains → where to transfer to save
  $X, and when each expires") — an under-served, stateful problem the comparison
  sites don't solve.
- **For breadth:** the only path to incumbent-level coverage is compiling public
  pricing pages (fragile, ToS-sensitive), not clean APIs.
- **Honest monetization:** lead with the cheapest option even when it pays
  nothing; that trust *is* the product.

---

## 5. Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Supabase-or-local
store · RDAP · GitHub Actions · Vercel. See [`README.md`](./README.md) to run it.
