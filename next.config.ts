import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  // Dev: Next bloqueia recursos /_next fora de localhost; libera loopback e LAN.
  allowedDevOrigins: ["127.0.0.1", "192.168.*.*"],
  serverExternalPackages: ["better-sqlite3"],
  devIndicators: false,
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
