import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPricesForTld } from "@/lib/store";
import { rankOffers, totalCost } from "@/lib/scoring";
import { registrarMeta } from "@/lib/registrars/meta";
import { TLDS, isKnownTld, normalizeTld } from "@/lib/tlds";
import { money } from "@/lib/format";

// Pre-render a comparison page for every covered TLD at build time.
export function generateStaticParams() {
  return TLDS.map((tld) => ({ tld }));
}

export const dynamicParams = false;

type CompareProps = { params: Promise<{ tld: string }> };

export async function generateMetadata(
  props: CompareProps,
): Promise<Metadata> {
  const { tld } = await props.params;
  const t = normalizeTld(tld);
  return {
    title: `Cheapest .${t} domain prices compared (2026) — NameScout`,
    description: `Compare .${t} registration and renewal prices across registrars. See the real 5-year cost, not just the year-1 promo.`,
  };
}

export default async function CompareTldPage(props: CompareProps) {
  const { tld } = await props.params;
  const t = normalizeTld(tld);
  if (!isKnownTld(t)) notFound();

  const offers = rankOffers(await getPricesForTld(t));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">
        Cheapest <span className="font-mono">.{t}</span> domain prices, compared
      </h1>
      <p className="mt-3 text-black/60 dark:text-white/60">
        Year-1 price is only half the story. Below is the registration price,
        the renewal price, and the <strong>true 5-year cost</strong> of a{" "}
        <span className="font-mono">.{t}</span> domain across registrars — sorted
        cheapest first.
      </p>

      {offers.length === 0 ? (
        <p className="mt-8 text-black/50 dark:text-white/50">
          No cached prices for .{t} yet. Run the sync job to populate prices.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 bg-black/[0.03] dark:bg-white/[0.03]">
                <th className="font-medium px-4 py-2.5">Registrar</th>
                <th className="font-medium px-4 py-2.5 text-right">Year 1</th>
                <th className="font-medium px-4 py-2.5 text-right">Renewal</th>
                <th className="font-medium px-4 py-2.5 text-right">5-yr total</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o, i) => (
                <tr
                  key={o.registrar}
                  className="border-t border-black/5 dark:border-white/5"
                >
                  <td className="px-4 py-2.5">
                    {registrarMeta(o.registrar).name}
                    {i === 0 && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide rounded bg-emerald-600 text-white px-1.5 py-0.5">
                        cheapest
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {money(o.register_price, o.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-black/70 dark:text-white/70">
                    {money(o.renew_price, o.currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {money(totalCost(o, 5), o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/"
          className="text-emerald-700 dark:text-emerald-400 hover:underline text-sm"
        >
          ← Search a specific name across all TLDs
        </Link>
      </div>
    </div>
  );
}
