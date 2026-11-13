import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev: Next bloqueia recursos /_next fora de localhost; libera loopback e LAN.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
