import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The search API reads data/prices.json at runtime. On serverless we must
  // explicitly trace it into the function bundle. (Compare pages are
  // statically prerendered at build time, so they bake the data in already.)
  outputFileTracingIncludes: {
    "/api/search": ["./data/prices.json"],
  },
};

export default nextConfig;
