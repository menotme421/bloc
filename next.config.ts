import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix physical device ERR_CONNECTION_REFUSED: dev chunks were hardcoded to http://localhost:3000
  // when accessed via LAN IP. Use relative URLs and allow LAN origins.
  assetPrefix: undefined,
  // Next 15+ dev origin check — allow phone's IP / tunnel
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://blocapps.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },

};

export default nextConfig;
