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
  // `next dev` jinak z telefonu v lokální síti zablokuje HMR i chunky —
  // vývoj na iPhonu přes https://<IP Macu>:3000 by se neobnovoval.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
};

export default nextConfig;
