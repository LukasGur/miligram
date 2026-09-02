import type { NextConfig } from "next";

/**
 * Statický export je záměr, ne zjednodušení:
 * výstup `out/` jde beze změn zabalit Capacitorem do nativní aplikace
 * a zároveň ho service worker umí celý přednačíst pro offline provoz.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
