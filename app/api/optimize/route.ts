import { optimize, parseDomains } from "@/lib/optimizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let raw = "";
  try {
    const body = (await request.json()) as { domains?: string | string[] };
    raw = Array.isArray(body.domains)
      ? body.domains.join("\n")
      : (body.domains ?? "");
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const domains = parseDomains(raw);
  if (!domains.length) {
    return Response.json(
      { error: "No valid domains found. Paste full domains like example.com." },
      { status: 400 },
    );
  }

  try {
    const result = await optimize(domains);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
