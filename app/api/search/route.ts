import type { NextRequest } from "next/server";
import { search } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (!q) {
    return Response.json({ query: "", label: "", results: [] });
  }
  // Allow skipping the (slower) RDAP availability pass for snappier previews.
  const availability = params.get("availability") !== "0";

  try {
    const data = await search(q, { availability });
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
