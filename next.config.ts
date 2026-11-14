import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheMaxMemorySize: 8 * 1024 * 1024,
  experimental: { cpus: 2 },
  distDir: process.env.CLIO_E2E === "1" ? ".next-e2e" : ".next",
  agentRules: false,
  devIndicators: false,
  logging: {incomingRequests:false},
  poweredByHeader: false,
  async headers() {
    return [{source:"/sw.js",headers:[{key:"Cache-Control",value:"no-store"}]},{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
