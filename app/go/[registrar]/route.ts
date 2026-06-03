import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { buildBuyLink } from "@/lib/affiliate";
import { REGISTRARS } from "@/lib/registrars/meta";
import type { RegistrarId } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Affiliate-aware outbound redirect. Routing every "Buy" click through here
 * keeps affiliate IDs server-side and gives us one place to add click logging
 * later. For now it just builds the (possibly affiliate-wrapped) URL and 302s.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ registrar: string }> },
) {
  const { registrar } = await ctx.params;
  if (!(registrar in REGISTRARS)) {
    return new Response("Unknown registrar", { status: 404 });
  }
  const domain = request.nextUrl.searchParams.get("d")?.trim();
  if (!domain) {
    return new Response("Missing domain", { status: 400 });
  }

  const { url } = buildBuyLink(registrar as RegistrarId, domain);
  redirect(url);
}
