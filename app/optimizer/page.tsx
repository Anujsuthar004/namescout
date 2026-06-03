"use client";

import { useState, useCallback } from "react";
import type { OptimizeResult, OptimizeRow } from "@/lib/optimizer";
import { money } from "@/lib/format";

const EXAMPLE = "google.com\nexample.org\nporkbun.com";

export default function OptimizerPage() {
  const [input, setInput] = useState("");
  const [data, setData] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (raw: string) => {
    if (!raw.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: raw }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setData(json as OptimizeResult);
    } catch (e) {
      setError((e as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Renewal optimizer
      </h1>
      <p className="mt-3 text-black/60 dark:text-white/60 max-w-2xl">
        Paste the domains you already own. NameScout detects where each one is
        registered and when it renews, then shows where you&rsquo;d pay less —
        and how much you&rsquo;d save over 5 years.
      </p>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder={EXAMPLE}
          className="w-full rounded-lg border border-black/15 dark:border-white/15 bg-transparent px-4 py-3 font-mono text-sm outline-none focus:border-emerald-500"
          aria-label="Domains you own, one per line"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-6 py-2.5"
          >
            {loading ? "Analyzing…" : "Find my savings"}
          </button>
          <button
            type="button"
            onClick={() => {
              setInput(EXAMPLE);
              run(EXAMPLE);
            }}
            className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Try an example
          </button>
          <span className="text-xs text-black/40 dark:text-white/40">
            up to 25 domains
          </span>
        </div>
      </form>

      {error && (
        <p className="mt-6 text-red-600 dark:text-red-400">{error}</p>
      )}

      {data && <Report data={data} />}
    </div>
  );
}

function Report({ data }: { data: OptimizeResult }) {
  if (!data.rows.length) return null;
  return (
    <div className="mt-10">
      {data.totalSavingsFiveYear > 0 ? (
        <div className="rounded-xl border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4">
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            Estimated 5-year savings across {data.withSavingsCount} of{" "}
            {data.ownedCount} owned domain
            {data.ownedCount === 1 ? "" : "s"}
          </div>
          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            {money(data.totalSavingsFiveYear)}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 dark:border-white/10 px-5 py-4 text-sm text-black/60 dark:text-white/60">
          No clear savings found across {data.ownedCount} owned domain
          {data.ownedCount === 1 ? "" : "s"} — either already cheap, or the
          current registrar/TLD isn&rsquo;t tracked yet.
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 bg-black/[0.03] dark:bg-white/[0.03]">
              <th className="font-medium px-4 py-2.5">Domain</th>
              <th className="font-medium px-4 py-2.5">Currently at</th>
              <th className="font-medium px-4 py-2.5">Renews</th>
              <th className="font-medium px-4 py-2.5 text-right">Cheapest renewal</th>
              <th className="font-medium px-4 py-2.5 text-right">5-yr savings</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <Row key={r.domain} r={r} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-black/40 dark:text-white/40">
        Registrar and renewal date come from live RDAP. Savings vs untracked
        registrars (e.g. GoDaddy, Namecheap) use <em>typical</em> renewal prices
        and are estimates — confirm against your invoice. Transferring usually
        adds a year and you keep remaining time.
      </p>
    </div>
  );
}

function ExpiryCell({ r }: { r: OptimizeRow }) {
  if (!r.expiry) return <span className="text-black/40 dark:text-white/40">—</span>;
  const d = new Date(r.expiry).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const soon = r.daysToExpiry != null && r.daysToExpiry <= 30 && r.daysToExpiry >= 0;
  return (
    <span className="whitespace-nowrap">
      {d}
      {soon && (
        <span className="ml-2 text-[10px] uppercase tracking-wide rounded bg-amber-500 text-white px-1.5 py-0.5">
          {r.daysToExpiry}d
        </span>
      )}
    </span>
  );
}

function Row({ r }: { r: OptimizeRow }) {
  const saving = r.savingsFiveYear ?? 0;
  return (
    <tr className="border-t border-black/5 dark:border-white/5 align-top">
      <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">
        {r.domain}
      </td>
      <td className="px-4 py-3">
        {r.currentRegistrar ?? (
          <span className="text-black/40 dark:text-white/40">
            {r.status === "available" ? "not owned" : "unknown"}
          </span>
        )}
        {r.currentRenewPrice != null && (
          <span className="block text-xs text-black/50 dark:text-white/50">
            ~{money(r.currentRenewPrice)}/yr
            {r.currentPriceEstimated && " est."}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <ExpiryCell r={r} />
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {r.cheapest ? (
          <>
            <span className="font-medium">{r.cheapest.name}</span>
            <span className="block text-xs text-black/60 dark:text-white/60 tabular-nums">
              {money(r.cheapest.renewPrice)}/yr
            </span>
          </>
        ) : (
          <span className="text-black/40 dark:text-white/40">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {saving > 0 ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {money(saving)}
          </span>
        ) : r.alreadyCheapest ? (
          <span className="text-xs text-black/50 dark:text-white/50">cheapest ✓</span>
        ) : (
          <span className="text-black/30 dark:text-white/30">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {saving > 0 && r.cheapest ? (
          <a
            href={r.cheapest.buyUrl}
            target="_blank"
            rel="nofollow sponsored noopener"
            className="inline-block rounded-md border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap"
          >
            Transfer &amp; save
          </a>
        ) : r.note ? (
          <span className="text-xs text-black/40 dark:text-white/40">{r.note}</span>
        ) : null}
      </td>
    </tr>
  );
}
