import type { PriceFeedAdapter } from "@/lib/types";
import { porkbunAdapter } from "./porkbun";
import { cloudflareAdapter } from "./cloudflare";
import { dynadotAdapter } from "./dynadot";

/** All known price-feed adapters, in priority order. */
export const ALL_FEEDS: PriceFeedAdapter[] = [
  porkbunAdapter,
  cloudflareAdapter,
  dynadotAdapter,
];

/** Only the adapters whose credentials/env are present right now. */
export const activeFeeds = (): PriceFeedAdapter[] =>
  ALL_FEEDS.filter((a) => a.isConfigured());

export { REGISTRARS, registrarMeta } from "./meta";
