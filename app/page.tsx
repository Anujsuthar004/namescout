"use client";

import { useState, useCallback } from "react";
import type { SearchResponse, DomainResult } from "@/lib/search";
import { money } from "@/lib/format";

export default function Home() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      setData(json as SearchResponse);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-12 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          The real cost of a domain — not the year-1 bait.
        </h1>
        <p className="mt-3 text-black/60 dark:text-white/60 max-w-2xl mx-auto">
          See the true 5-year cost of a domain — registration <em>plus</em>{" "}
          renewals — so a cheap first year can&rsquo;t fool you. Focused on the
          registrars known for <strong>flat, predictable pricing</strong>.
        </p>

        <form
          className="mt-8 flex gap-2 max-w-xl mx-auto"
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="mycoolstartup"
            className="flex-1 rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-4 py-3 outline-none focus:border-emerald-500"
            aria-label="Domain name to search"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-6 py-3"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>
        <p className="mt-2 text-xs text-black/40 dark:text-white/40">
          Try a bare name to check every TLD, or type a full domain like{" "}
          <code>acme.io</code>.
        </p>
        <p className="mt-4 text-xs text-black/40 dark:text-white/40">
          Currently comparing{" "}
          <span className="text-black/60 dark:text-white/60">Cloudflare</span>,{" "}
          <span className="text-black/60 dark:text-white/60">Porkbun</span> &{" "}
          <span className="text-black/60 dark:text-white/60">Dynadot</span> — the
          registrars with flat renewal pricing, where the 5-year cost is what you
          actually pay.
        </p>
      </section>

      {error && (
        <p className="text-center text-red-600 dark:text-red-400 mb-8">
          {error}
        </p>
      )}

      {data && <Results data={data} />}
    </div>
  );
}

function Results({ data }: { data: SearchResponse }) {
  if (!data.results.length) {
    return (
      <p className="text-center text-black/50 dark:text-white/50 py-12">
        Type a name and hit Search.
      </p>
    );
  }
  return (
    <div className="space-y-6 pb-8">
      {data.results.map((r) => (
        <DomainCard key={r.domain} result={r} />
      ))}
    </div>
  );
}

function AvailabilityBadge({ a }: { a: DomainResult["available"] }) {
  if (a === true)
    return (
      <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        available
      </span>
    );
  if (a === false)
    return (
      <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        taken
      </span>
    );
  return (
    <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50">
      availability unknown
    </span>
  );
}

function DomainCard({ result }: { result: DomainResult }) {
  const taken = result.available === false;
  return (
    <div
      className={`rounded-xl border border-black/10 dark:border-white/10 overflow-hidden ${
        taken ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/[0.03] dark:bg-white/[0.03]">
        <div className="flex items-center gap-3">
          <span className="font-mono font-semibold">{result.domain}</span>
          <AvailabilityBadge a={result.available} />
        </div>
        {result.cheapestFiveYear != null && (
          <span className="text-sm text-black/60 dark:text-white/60">
            from{" "}
            <strong className="text-foreground">
              {money(result.cheapestFiveYear)}
            </strong>{" "}
            / 5 yr
          </span>
        )}
      </div>

      {result.offers.length === 0 ? (
        <p className="px-4 py-3 text-sm text-black/50 dark:text-white/50">
          No cached prices for .{result.tld} yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50">
                <th className="font-medium px-4 py-2">Registrar</th>
                <th className="font-medium px-4 py-2 text-right">Year 1</th>
                <th className="font-medium px-4 py-2 text-right">Renewal</th>
                <th className="font-medium px-4 py-2 text-right">5-yr total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {result.offers.map((o, i) => (
                <tr
                  key={o.registrar}
                  className="border-t border-black/5 dark:border-white/5"
                >
                  <td className="px-4 py-2">
                    <span className="font-medium">{o.registrarName}</span>
                    {i === 0 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide rounded bg-emerald-600 text-white px-1.5 py-0.5">
                        best
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {money(o.register_price, o.currency)}
                    {o.promo && (
                      <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                        promo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-black/70 dark:text-white/70">
                    {money(o.renew_price, o.currency)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">
                    {money(o.five_year, o.currency)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a
                      href={o.buy_url}
                      target="_blank"
                      rel="nofollow sponsored noopener"
                      className="inline-block rounded-md border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1 text-xs font-medium transition-colors"
                    >
                      Buy{!o.monetized && " ↗"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
